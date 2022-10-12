class Defer {
    static async promises() {
        return Promise.all([
            this.createInsidiousFarmGroup()
        ]);
    };

    private static createInsidiousFarmGroup() {
        return new Promise<void>(async (resolve) => {
            if (location.href.includes(GroupAttack.groupCreationScreen)) {
                const groupCreationStatus = await Store.get(GroupAttack.creationKey) as boolean | undefined;
                if (groupCreationStatus === true) await GroupAttack.createDynamicGroup();
            };
            
            resolve();
        });
    };
};