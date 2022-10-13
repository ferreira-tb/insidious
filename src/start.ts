// Precisa sempre ser o último arquivo na lista do manifesto.
// Todo código que não estiver contido numa classe deve vir aqui.

// Insere os scripts com acesso ao contexto da página.
new Manatsu('script', document.body, { src: browser.runtime.getURL('./page/page.js') }).create();

// Inicia o Insidious.
(async () => {
    const insidiousStatus = await Store.get('insidiousStatus') as boolean | undefined;
    if (insidiousStatus !== false) {
        TWAssets.freeze();

        Insidious.updateGameData()
            .then(() => Insidious.start())
            .catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });
    };
})();