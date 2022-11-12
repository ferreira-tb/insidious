class VillageCommands implements CommandList {
    readonly amount: number;
    readonly attack: Set<Command> = new Set();
    readonly back: Set<Command> = new Set();
    readonly cancel: Set<Command> = new Set();
    readonly support: Set<Command> = new Set();
    readonly return: Set<Command> = new Set();

    constructor() {
        const commandRows = Array.from(document.querySelectorAll('#commands_outgoings tr.command-row'));
        for (const row of commandRows) {
            // Elementos.
            const details = row.querySelector('span.command_hover_details');
            if (!details) throw new InsidiousError('DOM: span.command_hover_details');

            const anchor = row.querySelector('a[href*="screen=info_command"]');
            if (!anchor) throw new InsidiousError('DOM: a[href*="screen=info_command"]');

            // Atributos.
            const id = details.getAttribute('data-command-id');
            if (!id) throw new InsidiousError('Não foi possível determinar o ID do comando.');

            const type = details.getAttribute('data-command-type') as CommandType | null;
            if (!type) throw new InsidiousError('Não foi possível determinar o tipo do comando.');

            const url = anchor.getAttribute('href');
            if (!url) throw new InsidiousError('Não foi possível determinar a URL do comando.');

            // Coordenadas e data.
            if (!row.textContent) throw new InsidiousError('Comando inválido.');
            const coords = Utils.getCoordsFromTextContent(row.textContent);
            if (!coords) throw new InsidiousError('Não foi possível determinar as coordenadas do alvo.');

            const getDate = (): number => {
                for (const cell of Array.from(row.querySelectorAll('td'))) {
                    const content = cell.textContent;
                    if (!content) continue;
    
                    const date = Utils.parseGameDate(content);
                    if (date) return date;
                };

                throw new InsidiousError('Não foi possível determinar a data do comando.');
            };

            const command = new Command(id, type, url, ...coords, getDate());
            this[type].add(command);
        };

        this.amount = this.#getCommandAmount();
    };

    #getCommandAmount() {
        let amount = 0;
        for (const value of Object.values(this)) {
            if (value instanceof Set) {
                amount += value.size;
            };
        };

        return amount;
    };
};

class VillageReturningResources implements ResourceAmount {
    readonly wood: number;
    readonly stone: number;
    readonly iron: number;
    
    constructor(htmlDocument: HTMLElement) {
        const [wood, stone, iron] = Assets.list.resources.map((res) => {
            const element = htmlDocument.querySelector(`#content_value table span.${res}`)?.parentElement
            if (!element || !element.textContent) return 0;

            return Number.parseInt(element.textContent, 10);
        });

        this.wood = wood;
        this.stone = stone;
        this.iron = iron;
    };
};