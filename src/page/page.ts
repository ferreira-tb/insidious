class PageScript {
    static start() {
        window.addEventListener('message', (e) => {
            if (e?.data?.direction === 'from-insidious') {
                PageScript.handleMessage(e.data.reason);
                return;
            };
        });
    };

    private static handleMessage(reason: WindowMessageReason) {
        switch (reason) {
            case 'get-game-data': PageScript.requestGameData()
                break;
        };
    };

    private static requestGameData() {
        const message: WindowMessage = {
            direction: 'from-tribalwars',
            game_data: TribalWars.getGameData()
        };

        window.postMessage(message);
    };
};

PageScript.start();