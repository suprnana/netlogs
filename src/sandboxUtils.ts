import storage from './api/storage';
import { serialize } from './controllers/settings';
import { defaultSettings } from './controllers/settings/base';
import network from './api/network';
import { createEventPayload, isIframeEvent, postSandbox } from './utils';
import AreaName = chrome.storage.AreaName;
import runtime from './api/runtime';
// DO NOT MOVE ANY FUNCTIONS IN THIS FILE OR CIRCULAR DEPENDENCY WILL OCCUR

// TODO: split into multiple handlers
export function wrapSandbox(): void {
    window.addEventListener('message', (event) => {
        if (isIframeEvent(event)) {
            const { type, id } = event.data;
            switch (type) {
                case 'onIframeReady':
                    postSandbox({
                        id,
                        type,
                        data: ''
                    });
                    break;
                case 'chrome.storage.local.get':
                    storage.local.get(
                        { settings: serialize(defaultSettings) },
                        ({ settings }) => {
                            postSandbox({
                                id,
                                type,
                                data: settings
                            });
                        }
                    );
                    break;
                case 'chrome.storage.onChanged.addListener':
                    storage.onChanged.addListener(
                        (
                            changes: {
                                [key: string]: chrome.storage.StorageChange;
                            },
                            areaName: AreaName
                        ) => {
                            if (
                                areaName === 'local' &&
                                changes.hasOwnProperty('settings') &&
                                changes.settings.newValue
                            ) {
                                postSandbox(
                                    createEventPayload(
                                        'chrome.storage.onChanged',
                                        JSON.stringify(
                                            changes.settings.newValue
                                        )
                                    )
                                );
                            }
                        }
                    );
                    break;
                case 'chrome.runtime.getManifest':
                    postSandbox({
                        id,
                        type,
                        data: JSON.stringify(chrome.runtime.getManifest())
                    });
                    break;
                case 'chrome.devtools.network.onNavigated.addListener':
                    network.onNavigated.addListener((url) => {
                        postSandbox(
                            createEventPayload(
                                'chrome.devtools.network.onNavigated',
                                url
                            )
                        );
                    });
                    break;
                case 'chrome.devtools.network.onRequestFinished.addListener':
                    network.onRequestFinished.addListener((request) => {
                        if ('getContent' in request) {
                            request.getContent((content) => {
                                request.response.content.text = content;
                                postSandbox(
                                    createEventPayload(
                                        'chrome.devtools.network.onRequestFinished',
                                        JSON.stringify(request)
                                    )
                                );
                            });
                        } else {
                            postSandbox(
                                createEventPayload(
                                    'chrome.devtools.network.onRequestFinished',
                                    JSON.stringify(request)
                                )
                            );
                        }
                    });
                    break;
                case 'chrome.runtime.openOptionsPage':
                    runtime.openOptionsPage();
                    break;
                case 'devtools.inspectedWindow.reload':
                    chrome.devtools.inspectedWindow.reload({});
                    break;
                default:
                    console.warn(`Unrecognized type ${type}`);
            }
        }
    });
}