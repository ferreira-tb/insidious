class TWSword {
    /** Quantidade de unidades (janela de confirmação de ataque). */
    private static confirm_screen: ConfirmScreenCommandDetails;
    /** Indica se há algum ataque agendado. */
    private static waiting_schedule: boolean = false;
    /** Ajuda a controlar o estado das promises. */
    static readonly eventTarget = new EventTarget();

    static async open() {
        if (location.href.includes('try=confirm')) this.showCommandOptions();
    };

    private static showCommandOptions() {
        const commandForm = document.querySelector('form#command-data-form');
        if (!commandForm) throw new InsidiousError('DOM: form#command-data-form');

        const selector = 'div table tbody tr td#date_arrival';
        const dateRow = commandForm.querySelector(selector)?.parentElement;
        if (!dateRow) throw new InsidiousError(`DOM: ${selector}`);

        // Registra a quantidade de unidades sendo enviada no ataque, além de outros detalhes.
        this.confirm_screen = new ConfirmScreenCommandDetails();

        const schedulerLabel = new Manatsu('td', { text: 'Agendar:' }).createInsideThenAfter(dateRow, ['tr']);
        const schedulerField = new Manatsu('td').createAfter(schedulerLabel);

        const dateString = Utils.getDateString(this.confirm_screen.travel_time);
        const dateInputOptions = {
            id: 'ins_schedule_date',
            style: 'vertical-align: middle;',
            type: 'datetime-local',
            step: '0.001',
            value: dateString,
            min: dateString
        };

        schedulerField.appendManatsu('input', dateInputOptions) as HTMLInputElement;
        schedulerField.appendManatsu('button', { id: 'ins_toggle_schedule', text: 'OK', style: 'margin-left: 5px' })
            .addEventListener('click', (e) => {
                e.preventDefault();
                this.handleScheduledCommand()
                    .catch((err: unknown) => InsidiousError.handle(err));
            });
    };

    /** Prepara ou cancela o agendamento de um comando. */
    private static handleScheduledCommand() {
        return new Promise<void>((resolve, reject) => {
            const attack = new ScheduledAttack();

            if (this.waiting_schedule === true) {
                this.eventTarget.dispatchEvent(new Event('cancelschedule'));
                
                this.waiting_schedule = false;
                attack.toggle_schedule.textContent = 'OK';
                resolve();

            } else {
                this.waiting_schedule = true;
                attack.toggle_schedule.textContent = 'Cancelar';

                // Tempo, em milisegundos, até o envio do ataque.
                const parsedDate = Date.parse(attack.date_input.value);
                const arrivalTime = Date.now() + this.confirm_screen.travel_time + this.confirm_screen.time_diff;
                const timeUntil = parsedDate - arrivalTime;

                if (timeUntil <= 0) {
                    this.waiting_schedule = false;
                    attack.toggle_schedule.textContent = 'OK';
                    return reject(new InsidiousError('A data de envio é inválida.'));
                };
    
                const scheduleTimeout = setTimeout(() => {
                    this.waiting_schedule = false;
                    attack.submit.click();
                    resolve();
                }, timeUntil);
    
                const scheduleCtrl = new AbortController();
                this.eventTarget.addEventListener('cancelschedule', () => {
                    clearTimeout(scheduleTimeout);
                    scheduleCtrl.abort();
                    resolve();
                }, { signal: scheduleCtrl.signal });
            };
        });
    };
};