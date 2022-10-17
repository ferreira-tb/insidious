// Manifest V3
interface EvListener<T extends Function> {
    addListener: (callback: T) => void;
    removeListener: (listener: T) => void;
    hasListener: (listener: T) => boolean;
}

type Listener<T> = EvListener<(arg: T) => void>;

declare namespace browser.storage {
    type StorageValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | StorageArray
    | StorageObject

    // Valores específicos do Insidious.
    | PlunderGroupNavigation
    | PlunderPageNavigation
    | WorldInfo
    | UnitInfo
    | ShieldStatus
    | ShieldNavigation
    | NothingPlundered

    interface StorageArray extends Array<StorageValue> {}

    interface StorageObject {
        [key: string]: StorageValue;
    }

    interface Get {
        <T extends StorageObject>(keys?: string | string[] | null): Promise<T>;
        <T extends StorageObject>(keys: T): Promise<T>;
    }

    type StorageArea = {
        get: Get;
        set: (keys: StorageObject) => Promise<void>;
        remove: (keys: string | string[]) => Promise<void>;
        clear: () => Promise<void>;
    };

    const local: StorageArea;
}

declare namespace browser.action {
    const onClicked: Listener<browser.tabs.Tab>;
}

declare namespace browser.runtime {
    const lastError: string | null;
    const id: string;

    type Port = {
        name: string;
        disconnect(): void;
        error: object;
        onDisconnect: Listener<Port>;
        onMessage: Listener<object>;
        postMessage: <T = object>(message: T) => void;
        sender?: runtime.MessageSender;
    };

    type MessageSender = {
        tab?: browser.tabs.Tab;
        frameId?: number;
        id?: string;
        url?: string;
        tlsChannelId?: string;
    };
    
    type PlatformOs = "mac" | "win" | "android" | "cros" | "linux" | "openbsd";
    type PlatformArch = "arm" | "x86-32" | "x86-64";
    type PlatformNaclArch = "arm" | "x86-32" | "x86-64";
    
    type PlatformInfo = {
        os: PlatformOs;
        arch: PlatformArch;
    };

    type FirefoxSpecificProperties = {
        id?: string;
        strict_min_version?: string;
        strict_max_version?: string;
        update_url?: string;
    };

    function connect(
        connectInfo?: { name?: string; includeTlsChannelId?: boolean }
    ): Port;

    function connect(
        extensionId?: string,
        connectInfo?: { name?: string; includeTlsChannelId?: boolean }
    ): Port;

    function connectNative(application: string): Port;
    function getBackgroundPage(): Promise<Window>;
    function getURL(path: string): string;
    function setUninstallURL(url: string): Promise<void>;
    function reload(): void;
    function getPlatformInfo(): Promise<PlatformInfo>;
    
    // Alterado para atender apenas ao Insidious.
    function sendMessage(message: AllMessageTypes): Promise<void>;

    type onMessagePromise = (
        message: object,
        sender: MessageSender,
        sendResponse: (response: object) => boolean
    ) => Promise<void>;
    
    type onMessageBool = (
        message: object,
        sender: MessageSender,
        sendResponse: (response: object) => Promise<void>
    ) => boolean;
    
    type onMessageVoid = (
        message: object,
        sender: MessageSender,
        sendResponse: (response: object) => Promise<void>
    ) => void;
    
    type onMessageEvent = onMessagePromise | onMessageBool | onMessageVoid;

    const onMessage: EvListener<onMessageEvent>;
}

declare namespace browser.tabs {
    type MutedInfoReason = "capture" | "extension" | "user";
    type MutedInfo = {
        muted: boolean;
        extensionId?: string;
        reason: MutedInfoReason;
    };

    type PageSettings = object;
    type Tab = {
        active: boolean;
        audible?: boolean;
        autoDiscardable?: boolean;
        cookieStoreId?: string;
        discarded?: boolean;
        favIconUrl?: string;
        height?: number;
        hidden: boolean;
        highlighted: boolean;
        id?: number;
        incognito: boolean;
        index: number;
        isArticle: boolean;
        isInReaderMode: boolean;
        lastAccessed: number;
        mutedInfo?: MutedInfo;
        openerTabId?: number;
        pinned: boolean;
        selected: boolean;
        sessionId?: string;
        status?: string;
        title?: string;
        url?: string;
        width?: number;
        windowId: number;
    };

    type TabStatus = "loading" | "complete";
    type WindowType = "normal" | "popup" | "panel" | "devtools";
    type ZoomSettingsMode = "automatic" | "disabled" | "manual";
    type ZoomSettingsScope = "per-origin" | "per-tab";
    type ZoomSettings = {
        defaultZoomFactor?: number;
        mode?: ZoomSettingsMode;
        scope?: ZoomSettingsScope;
    };

    const TAB_ID_NONE: number;

    function connect(
        tabId: number,
        connectInfo?: { name?: string; frameId?: number }
    ): browser.runtime.Port;

    /** https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create */
    function create(createProperties: {
        active?: boolean;
        cookieStoreId?: string;
        index?: number;
        openerTabId?: number;
        pinned?: boolean;
        url: WebExtTabURLs; // Alterado para atender apenas ao Insidious (original: string).
        windowId?: number;
    }): Promise<Tab>;

    function duplicate(tabId: number): Promise<Tab>;

    function query(queryInfo: {
        active?: boolean;
        audible?: boolean;
        cookieStoreId?: string;
        currentWindow?: boolean;
        discarded?: boolean;
        hidden?: boolean;
        highlighted?: boolean;
        index?: number;
        muted?: boolean;
        lastFocusedWindow?: boolean;
        pinned?: boolean;
        status?: TabStatus;
        title?: string;
        url?: string | string[];
        windowId?: number;
        windowType?: WindowType;
    }): Promise<Tab[]>;

    function reload(
        tabId?: number,
        reloadProperties?: { bypassCache?: boolean }
    ): Promise<void>;

    function remove(tabIds: number | number[]): Promise<void>;

    function sendMessage<T = any, U = object>(
        tabId: number,
        message: T,
        options?: { frameId?: number }
    ): Promise<U | void>;

    function show(tabIds: number | number[]): Promise<void>;

    const onActivated: Listener<{ tabId: number; windowId: number }>;

    const onAttached: EvListener<
        (
        tabId: number,
        attachInfo: {
            newWindowId: number;
            newPosition: number;
        }
        ) => void
    >;
    const onCreated: Listener<Tab>;

    const onDetached: EvListener<(
        tabId: number,
        detachInfo: {
            oldWindowId: number;
            oldPosition: number;
        }
    ) => void>;

    const onHighlighted: Listener<{ windowId: number; tabIds: number[] }>;

    const onMoved: EvListener<(
        tabId: number,
        moveInfo: {
            windowId: number;
            fromIndex: number;
            toIndex: number;
        }
    ) => void>;

    const onRemoved: EvListener<(
        tabId: number,
        removeInfo: {
            windowId: number;
            isWindowClosing: boolean;
        }
    ) => void>;

    const onReplaced: EvListener<(addedTabId: number, removedTabId: number) => void>;

    const onUpdated: EvListener<(
        tabId: number,
        changeInfo: {
            audible?: boolean;
            discarded?: boolean;
            favIconUrl?: string;
            mutedInfo?: MutedInfo;
            pinned?: boolean;
            status?: string;
            title?: string;
            url?: string;
        },
        tab: Tab
    ) => void>;

    const onZoomChanged: Listener<{
        tabId: number;
        oldZoomFactor: number;
        newZoomFactor: number;
        zoomSettings: ZoomSettings;
    }>;
}

declare namespace browser.windows {
    type WindowType = "normal" | "popup" | "panel" | "devtools";

    type WindowState =
        | "normal"
        | "minimized"
        | "maximized"
        | "fullscreen"
        | "docked";

    type Window = {
        id?: number;
        focused: boolean;
        top?: number;
        left?: number;
        width?: number;
        height?: number;
        tabs?: browser.tabs.Tab[];
        incognito: boolean;
        type?: WindowType;
        state?: WindowState;
        alwaysOnTop: boolean;
        sessionId?: string;
    };

    type CreateType = "normal" | "popup" | "panel" | "detached_panel";

    const WINDOW_ID_NONE: number;

    const WINDOW_ID_CURRENT: number;

    function get(
        windowId: number,
        getInfo?: {
            populate?: boolean;
            windowTypes?: WindowType[];
        }
    ): Promise<browser.windows.Window>;
    
    function getCurrent(getInfo?: {
        populate?: boolean;
        windowTypes?: WindowType[];
    }): Promise<browser.windows.Window>;
    
    function getLastFocused(getInfo?: {
        populate?: boolean;
        windowTypes?: WindowType[];
    }): Promise<browser.windows.Window>;
    
    function getAll(getInfo?: {
        populate?: boolean;
        windowTypes?: WindowType[];
    }): Promise<browser.windows.Window[]>;

    /** https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create */
    function create(createData?: {
        allowScriptsToClose?: boolean;
        url: WebExtWindowURLs // Alterado para atender apenas ao Insidious (original: string | string[]).
        tabId?: number;
        left?: number;
        top?: number;
        width?: number;
        height?: number;
        incognito?: boolean;
        titlePreface?: string;
        type?: CreateType;
        state?: WindowState;
    }): Promise<browser.windows.Window>;

    /** https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/update */
    function update(
        windowId: number,
        updateInfo: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            focused?: boolean;
            drawAttention?: boolean;
            state?: WindowState;
        }
    ): Promise<browser.windows.Window>;
    
    function remove(windowId: number): Promise<void>;
    
    const onCreated: Listener<browser.windows.Window>;
    
    const onRemoved: Listener<number>;
    
    const onFocusChanged: Listener<number>;
}

declare namespace browser.scripting {
    type ContentScriptFilter = { ids: string[] };

    type InjectionTarget = {
        allFrames?: boolean;
        frameIds?: number[];
        tabId: number;
    };

    type InjectionResult = {
        frameId: number;
        result?: any;
        error?: { message: string };
    };

    type RegisteredContentScript = {
        allFrames?: boolean;
        css?: string[];
        excludeMatches?: string[];
        id: string;
        js?: string[];
        matches?: string[];
        persistAcrossSessions?: boolean;
    };

    type ScriptDetails = {
        files: string[];
        injectImmediately?: boolean;
        target: InjectionTarget;
    };

    function getRegisteredContentScripts(filter?: ContentScriptFilter): Promise<RegisteredContentScript[]>;

    function registerContentScripts(scripts: RegisteredContentScript[]): Promise<RegisteredContentScript[]>;

    function unregisterContentScripts(scripts?: ContentScriptFilter): Promise<void>;

    function updateContentScripts(scripts: RegisteredContentScript[]): Promise<RegisteredContentScript[]>;

    function executeScript(details: ScriptDetails): Promise<InjectionResult[]>;
}

declare namespace browser.notifications {
    type TemplateType = "basic";
  
    type NotificationOptions = {
        type: TemplateType;
        message: string;
        title: string;
        iconUrl?: string;
    };
  
    function create(
        id: string | null,
        options: NotificationOptions
    ): Promise<string>;

    function create(options: NotificationOptions): Promise<string>;
  
    function clear(id: string): Promise<boolean>;
  
    function getAll(): Promise<{ [key: string]: NotificationOptions }>;
  
    const onClosed: Listener<string>;
  
    const onClicked: Listener<string>;
  }