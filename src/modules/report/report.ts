class TWReport {
    static async open() {
        if (location.href.includes('view=')) this.showCurrentLoyalty();
    };

    private static showCurrentLoyalty() {
        const attackResults = document.querySelector('table#attack_results tbody');
        if (!attackResults) throw new InsidiousError('DOM: table#attack_results tbody');

        const headers = Array.from(attackResults.querySelectorAll('tr th'));
        for (const header of headers) {
            const content = header.textContent?.toLowerCase();
            if (content && content.includes('lealdade')) { 
                const reportDate = this.getReportDate();
                const millisecsSince = Date.now() - reportDate;
                
                const loyaltyChange = header.nextElementSibling?.textContent?.trim();
                if (!loyaltyChange) throw new InsidiousError('Não possível encontrar o campo com a mudança de lealdade.');
                let lastKnownLoyalty = loyaltyChange.split(' ')
                    .map((value) => Number.parseInt(value, 10))
                    .filter((value) => !Number.isNaN(value))[1];

                if (!lastKnownLoyalty) throw new InsidiousError('Não foi possível determinar a lealdade.');
                if (lastKnownLoyalty < 1) lastKnownLoyalty = 25;

                const loyaltyPerHour = Game.worldInfo.speed;
                const recovered = loyaltyPerHour * (millisecsSince / 3600000);
                
                let loyaltyNow = lastKnownLoyalty + recovered;
                if (loyaltyNow > 100) loyaltyNow = 100;
                loyaltyNow = Math.trunc(loyaltyNow);

                const loyaltyField = header.nextElementSibling;
                if (!loyaltyField) throw new InsidiousError('Não foi possível encontrar o campo com a lealdade.');
                new Manatsu('span', loyaltyField, { text: ` (atual: ${String(loyaltyNow)})` }).create();
            };
        };
    };

    private static getReportDate() {
        const selector = 'td.nopad table.vis tr td:not(.maincell)';
        const dateLabel = Manatsu.getElementByTextContent('Data da batalha', selector, false, false);
        if (!dateLabel) throw new InsidiousError(`DOM: ${selector}`);

        // Exemplo: "out. 17, 2022  22:16:46:503".
        const rawDate = dateLabel.nextElementSibling?.textContent?.trim();
        if (!rawDate) throw new InsidiousError('Não foi possível determinar a data do relatório.');

        const getDigits = (value: string) => Number.parseInt(value.replace(/\D/g, ''), 10);

        const rawDateFields = rawDate.split(' ')
            .filter((value) => value)
            .map((value) => value.trim());

        const dateFields = rawDateFields.map((field, index) => {
            if (index === 0) {
                const month = field.replace(/\W/g, '').slice(0, 3) as Months;
                if (!month || !Assets.misc.months.includes(month)) throw new InsidiousError('O mês obtido é inválido.');

                // No método setFullYear() é usado índice zero para meses.
                return Assets.misc.months.indexOf(month);

            } else if (index === 3) {
                return field.split(':').map((value) => getDigits(value));
      
            } else {
                return getDigits(field);
            };
        });

        const year = dateFields[2] as number;
        const month = dateFields[0] as number;
        const day = dateFields[1] as number;
        const fullYear = new Date().setFullYear(year, month, day);

        const [hour, minute, second, millisec] = dateFields[3] as number[];
        const date = new Date(fullYear).setHours(hour, minute, second, millisec);
        if (!Number.isInteger(date)) throw new InsidiousError('A data obtida é inválida.');

        return date;
    };
};