class TWOverview {
    static async open() {
        await this.verifyInsidiousFarmGroup();
    };

    /**
     * Verifica se o grupo Insidious, usado pelo Plunder, existe.
     * Em caso negativo, remove o id salvo no banco de dados.
     */ 
    private static async verifyInsidiousFarmGroup() {
        // Retorna se estiver na seção de grupos.
        // Lá a listagem de grupos não é exibida por completo.
        if (document.querySelector('#group_management_content')) return;

        const overviewContent = document.querySelector('div#paged_view_content');
        if (overviewContent) {
            const insidiousGroupID = await Store.get(Keys.farmGroup) as string | undefined;
            if (!insidiousGroupID) return;

            const groupList = Array.from(overviewContent.querySelectorAll('.group-menu-item'));
            if (groupList.length === 0) throw new InsidiousError('Nenhum grupo foi encontrado.');

            for (const group of groupList) {
                const groupID = group.getAttribute('data-group-id');
                if (!groupID) throw new InsidiousError('DOM: .group-menu-item[data-group-id]');
                if (groupID === insidiousGroupID) return;
            };
            
            await Store.remove(Keys.farmGroup);
        };
    };
};