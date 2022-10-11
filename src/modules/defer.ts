class Defer {
    static async #promises() {
        return Promise.all([
            this.#createInsidiousFarmGroup()
        ]);
    };

    static #createInsidiousFarmGroup() {
        return new Promise<void>(async (resolve) => {
            if (location.href.includes(GroupAttack.groupCreationScreen)) {
                const groupCreationStatus = (await browser.storage.local.get(GroupAttack.creationKey))[GroupAttack.creationKey];
                if (groupCreationStatus === 'pending') await GroupAttack.createDynamicGroup();
            };
            
            resolve();
        });
    };

    static get promises() {return this.#promises};
};