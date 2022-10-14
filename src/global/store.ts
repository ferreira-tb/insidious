class Store {
    static readonly get = async (key: string) => {
        return (await browser.storage.local.get(key))[key];
    };

    static readonly set = browser.storage.local.set;
    static readonly remove = browser.storage.local.remove;
    static readonly clear = browser.storage.local.clear;
};