// Precisa sempre ser o último arquivo na lista do manifesto.
// Todo código que não estiver contido numa classe deve vir aqui.
(async () => {
    const insidiousStatus = await Store.get('insidiousStatus') as boolean | undefined;
    if (insidiousStatus !== false) {
        if (insidiousStatus === undefined) await Store.set({ ['insidiousStatus']: true });

        TWAssets.freeze();
        Insidious.start();
    };
})();