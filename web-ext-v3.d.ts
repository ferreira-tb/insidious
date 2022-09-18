interface EvListener<T extends Function> {
    addListener: (callback: T) => void;
    removeListener: (listener: T) => void;
    hasListener: (listener: T) => boolean;
  }
  
type Listener<T> = EvListener<(arg: T) => void>;


declare namespace browser.action {
    const onClicked: any;
}

declare namespace browser.storage {
    type StorageValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | StorageObject;

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

declare namespace browser.runtime {
    type Port = {
        name: string;
        disconnect(): void;
        onMessage: Listener<object>;
        postMessage: <T = object>(message: T) => void;
    };

    type onMessagePromise = (
        message: object,
        sendResponse: (response: object) => boolean
    ) => Promise<void>;
    
    type onMessageBool = (
        message: object,
        sendResponse: (response: object) => Promise<void>
    ) => boolean;
    
    type onMessageVoid = (
        message: object,
        sendResponse: (response: object) => Promise<void>
    ) => void;

    type onMessageEvent = onMessagePromise | onMessageBool | onMessageVoid;

    const onConnect: Listener<Port>;
    const onMessage: EvListener<onMessageEvent>;

    function connect(
        connectInfo?: { name?: string; includeTlsChannelId?: boolean }
    ): Port;

    function sendMessage<T = any, U = any>(
        message: T,
    ): Promise<U>;
}