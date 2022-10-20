class TWSword {
    static async open() {
        if (location.href.includes('try=confirm')) this.showCommandOptions();
    };

    private static showCommandOptions() {
        const commandForm = document.querySelector('form#command-data-form');
        if (!commandForm) throw new InsidiousError('DOM: form#command-data-form');

        const selector = 'div table tbody tr td#date_arrival';
        const dateRow = commandForm.querySelector(selector)?.parentElement;
        if (!dateRow) throw new InsidiousError(`DOM: ${selector}`);

        const schedulerLabel = new Manatsu('td', { text: 'Agendar:' }).createInsideThenAfter(dateRow, ['tr']);
        const schedulerField = new Manatsu('td').createAfter(schedulerLabel);

        const dateOptions = { type: 'datetime-local', step: '0.001', min: Utils.getDateString() };
        schedulerField.appendManatsu('input', dateOptions) as HTMLInputElement;
        schedulerField.appendManatsu('button', { text: 'OK' });
    };
};