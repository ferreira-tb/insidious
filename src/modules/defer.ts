class Defer {
    static async promises() {
        return Promise.all([
            this.createInsidiousFarmGroup()
        ]);
    };

    private static createInsidiousFarmGroup() {
        return new Promise<void>(async (resolve) => {
            if (location.href.includes(Assets.url.group_creation_screen)) {
                const groupCreationStatus = await Store.get(Keys.farmGroupCreation) as boolean | undefined;

                if (groupCreationStatus === true) {
                    await Store.remove(Keys.farmGroupCreation);

                    const groupNameInput = document.querySelector('form input#group_name') as HTMLInputElement | null;
                    if (!groupNameInput) throw new InsidiousError('DOM: form input#group_name');
                    groupNameInput.value = 'Insidious';

                    const groupCreationButton = document.querySelector('form input#btn_filters_create') as HTMLInputElement | null;
                    if (!groupCreationButton) throw new InsidiousError('form input#btn_filters_create');
                    groupCreationButton.click();
                };
            };
            
            resolve();
        });
    };
};