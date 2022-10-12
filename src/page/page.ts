class PageScript {
    static start() {
        window.addEventListener('message', (e) => {
            if (e?.data === 'from-insidious') {
                PageScript.isInsidiousReady();
                return;
            };
        });
    };

    private static isInsidiousReady() {
        const gameData = TribalWars.getGameData();
        window.postMessage({
            direction: 'from-tribalwars',
            game_data: new GameData(gameData)
        });
    };
};

PageScript.start();