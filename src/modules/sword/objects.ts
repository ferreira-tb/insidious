class ConfirmScreenCommandDetails implements AvailableUnits {
    // Unidades
    spear: number = 0;
    sword: number = 0;
    axe: number = 0;
    archer: number = 0;
    spy: number = 0;
    light: number = 0;
    marcher: number = 0;
    heavy: number = 0;
    ram: number = 0;
    catapult: number = 0;
    knight: number = 0;
    snob: number = 0;

    // Informações
    /** Distância até à aldeia-alvo. */
    readonly distance: number;
    /** Velocidade da unidade mais lenta do ataque. */
    #slowest_speed: number = 0;
    /** Tempo de viagem em milisegundos. */
    readonly travel_time: number;
    /** Diferença entre a hora local e a do servidor. */
    readonly time_diff: number;

    /** Cria um objeto com informações sobre o comando sendo enviado no momento. */
    constructor() {
        // Linha com a quantidade de cada unidade.
        const units_row = document.querySelector('table#place_confirm_units tr.units-row');
        if (!units_row) throw new InsidiousError('DOM: table#place_confirm_units tr.units-row');

        const units_fields = Array.from(units_row.querySelectorAll('td.unit-item'));
        Assets.list.all_units_archer.forEach((unit) => {
            units_fields.some((field) => {
                const class_name = field.getAttribute('class');
                if (class_name?.includes(unit)) {
                    const unit_amount = field.textContent?.trim();
                    if (!unit_amount) {
                        throw new InsidiousError(`Não foi possível determinar a quantidade de unidades (${unit})`);
                    };

                    this[unit] = Number.parseInt(unit_amount, 10);
                    if (Number.isNaN(this[unit])) throw new InsidiousError(`A quantidade de unidades é inválida ${unit}`);

                    const unit_speed = Game.unitInfo[unit].speed;
                    if (unit_speed > this.#slowest_speed && this[unit] > 0) {
                        this.#slowest_speed = unit_speed;
                    };

                    return true;
                };

                return false;

            }, this);
        }, this);

        // Formulário da janela de comando.
        const commandForm = document.querySelector('form#command-data-form');
        if (!commandForm) throw new InsidiousError('DOM: form#command-data-form');

        // Campo com o nome e as coordenadas da aldeia alvo.
        const targetCoordsField = commandForm.querySelector('td span.village_anchor[data-player] a[href*=\"village\"]');
        if (!targetCoordsField) throw new InsidiousError('DOM: td span.village_anchor[data-player] a[href*=\"village\"]');

        // Coordenadas da aldeia-alvo.
        const targetCoords = targetCoordsField.textContent?.match(/\d\d\d\|\d\d\d/m);
        if (!targetCoords || targetCoords.length === 0) throw new InsidiousError('Não foi possível obter as coordenadas do alvo.');

        const coords = targetCoords[0].split('\|').map(value => Number.parseInt(value, 10));
        this.distance = Utils.calcDistance(Game.x, Game.y, coords[0], coords[1]);

        // Tempo de viagem até o alvo.
        const worldUnitSpeed = Game.worldInfo.unit_speed;
        const millisecondsPerField = 60000 * (this.#slowest_speed * worldUnitSpeed);
        this.travel_time = millisecondsPerField * this.distance;

        // Diferença entre a hora local e a do servidor.
        const insidious = document.head.querySelector('insidious') as HTMLElement;
        const raw_time_diff = insidious.getAttribute('time_diff') as string;
        this.time_diff = Number.parseInt(raw_time_diff, 10);

        if (Number.isNaN(this.time_diff)) {
            throw new InsidiousError('Não foi possível determinar a diferença entre a hora local e a do servidor.');
        };
    };
};

class ScheduledAttack {
    readonly submit: HTMLInputElement;
    readonly date_input: HTMLInputElement;
    readonly toggle_schedule: HTMLButtonElement;
    
    constructor() {
        this.submit = document.querySelector('#troop_confirm_submit') as HTMLInputElement;
        if (!this.submit) throw new InsidiousError('DOM: #troop_confirm_submit');

        this.date_input = document.querySelector('#insidious_schedule_date') as HTMLInputElement;
        if (!this.date_input) throw new InsidiousError('DOM: #insidious_schedule_date');

        this.toggle_schedule = document.querySelector('#insidious_toggle_schedule') as HTMLButtonElement;
        if (!this.toggle_schedule) throw new InsidiousError('DOM: #insidious_toggle_schedule');
    };
};