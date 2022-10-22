class Dealer {
    static average: AveragePremiumExchangeRate;

    static async start() {
        const exchangeData = await this.requestPremiumExchangeData();
        this.average = new AveragePremiumExchangeRate(exchangeData);
    };

    private static requestPremiumExchangeData() {
        return new Promise<PremiumExchangeData>((resolve) => {
            const request = (e: MessageEvent<WindowMessageFromPage>) => {     
                if (e?.data?.direction === 'from-tribalwars') {
                    window.removeEventListener('message', request);

                    if (!e.data.premium_exchange) {
                        throw new InsidiousError('Não foi possível obter o histórico da Troca Premium.');
                    };
                    
                    resolve(e.data.premium_exchange);
                };
            };

            window.addEventListener('message', request);
            window.postMessage(new Bridge('get-premium-exchange'));
        });
    };
};