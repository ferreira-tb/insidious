class Options {
    static readonly plunder: AssetsPlunderOptions = {
        checkbox: ['ignore_wall', 'destroy_wall', 'group_attack', 'use_c', 'no_delay'],
        number: ['max_distance', 'ignore_older_than', 'minutes_until_reload']
    };

    static readonly player: AssetsPlayerOptions = {
        radio: ['show_distance', 'show_time', 'hide_all']
    };
};

class InsidiousInputAttributes implements InputAttributes {
    private readonly option: AllInsidiousOptions;

    readonly id: `ins_${AllInsidiousOptions}`;
    readonly label: string;
    readonly min?: string;
    readonly name?: `ins_radio_option_${string}`;
    readonly placeholder?: string;

    constructor(option: AllInsidiousOptions, type: InputElement) {
        this.option = option;
        this.id = `ins_${option}`;
        this.label = this.#setLabel();

        if (type === 'radio') {
            const index = InsidiousInputAttributes.index();
            this.name = `ins_radio_option_${index}`;

        } else if (type === 'number') {
            this.min = this.#setMin();
            this.placeholder = this.#setPlaceholder();
        };

        for (const [key, value] of Object.entries(this)) {
            if (!value) delete this[key as keyof this];
        };
    };

    #setLabel() {
        switch (this.option) {
            // PLAYER
            case 'show_distance': return 'Mostrar distância';
            case 'show_time': return 'Mostrar tempo';
            case 'hide_all': return 'Ocultar informações';

            // PLUNDER
            case 'group_attack': return 'Usar grupo';
            case 'ignore_wall': return 'Ignorar muralha';
            case 'destroy_wall': return 'Destruir muralha';
            case 'use_c': return 'Usar modelo C';
            case 'no_delay': return 'Ignorar delay';

            case 'max_distance': return 'Distância máxima';
            case 'ignore_older_than': return 'Idade máxima (horas)';
            case 'minutes_until_reload': return 'Recarregamento automático (minutos)';
        };
    };

    #setMin() {
        switch (this.option) {
            // PLUNDER
            case 'minutes_until_reload': return '1';
            default: return '0';
        };
    };

    #setPlaceholder() {
        switch (this.option) {
            // PLUNDER
            case 'minutes_until_reload': return '10';
            default: return '0';
        };
    };

    static #setIndex() {
        let index = 1;
        return function() {
            return String(++index);
        };
    };

    static get index() { return this.#setIndex() };
};