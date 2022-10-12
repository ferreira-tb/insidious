// Precisa sempre ser o último arquivo na lista do manifesto.
// Todo código que não estiver contido numa classe deve vir aqui.

// Insere os scripts com acesso ao contexto da página.
new Manatsu('script', document.body, { src: browser.runtime.getURL('./page/objects.js') }).create();
new Manatsu('script', document.body, { src: browser.runtime.getURL('./page/page.js') }).create();

// Inicia o Insidious.
(async () => {
    const insidiousStatus = await Store.get('insidiousStatus') as boolean | undefined;
    if (insidiousStatus !== false) {
        if (insidiousStatus === undefined) await Store.set({ ['insidiousStatus']: true });

        TWAssets.freeze();

        new Promise<GameData>((resolve) => {
            window.addEventListener('message', (e) => {
                if (e?.data?.direction === 'from-tribalwars') {
                    resolve(e.data.game_data as GameData);
                };
            });

            window.postMessage('from-insidious');

        }).then((data) => Insidious.start(data)).catch((err: unknown) => {
            if (err instanceof Error) InsidiousError.handle(err);
        });

    };
})();