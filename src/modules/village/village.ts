class TWVillage {
    private static readonly commands = new VillageCommands();

    static async open() {
        await this.showReturningResources();
    };

    static async showReturningResources() {
        const widget = new Manatsu({ id: 'ins_show_returning', class: 'vis moveable widget' }).create();
        const title = new Manatsu('h4', widget, { class: 'head ui-sortable-handle' }).create();

        const content = widget.appendManatsu({ class: 'widget_content', style: 'display: block;' })
        const table = content.appendManatsu('table', { style: 'width: 100%;' });
        
        Assets.list.resources.forEach((res) => {
            const tr = table.appendManatsu('tr', { class: 'nowrap' });
            const resLabel = tr.appendManatsu('td', { style: 'width: 70px;' });
            resLabel.appendManatsu('span', { class: `icon header ${res}` });
            resLabel.appendManatsu('span', { text: Utils.translateResourceName(res) });

            new Manatsu('strong', tr, { id: `ins_returning_${res}`, text: '0' }).createInside('td');
        });

        try {
            const resources = new ResourceAmount();

            // Widget que exibe a produção de recursos da aldeia.
            const productionWidget = document.querySelector('#show_prod.widget');
            if (!productionWidget) throw new InsidiousError('DOM: #show_prod.widget');
    
            let commandAmount = 0;
            let widgetIsAppended = false;
            for await (const returning of this.fetchReturningResources()) {
                Assets.list.resources.forEach((res) => {
                    resources[res] += returning[res];
                    if (widgetIsAppended === false) {
                        productionWidget.insertAdjacentElement('afterend', widget);
                        widgetIsAppended = true;
                    };
    
                    const resField = widget.querySelector(`#ins_returning_${res}`);
                    if (!resField) throw new InsidiousError(`DOM: #ins_returning_${res}`);
                    resField.textContent = resources[res].toLocaleString('pt-br');
                });

                const percentage = (++commandAmount / this.commands.return.size) * 100;
                title.textContent = `Retornando (${percentage.toFixed(1)}%)`;
            };

        } catch (err) {
            InsidiousError.handle(err);

        } finally {
            title.textContent = 'Retornando';
        };
    };

    static async *fetchReturningResources() {
        try {
            const parser = new DOMParser();
            for (const command of this.commands.return) {
                const result = await fetch(command.url);
                const text = await result.text();
                const htmlDocument = parser.parseFromString(text, 'text/html').documentElement;
                yield new VillageReturningResources(htmlDocument);
            };

        } catch (err) {
            InsidiousError.handle(err);
        };
    };
};