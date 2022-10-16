// Precisa sempre ser o último arquivo na lista do manifesto.
// Todo código que não estiver contido numa classe deve vir aqui.
new MutationObserver((mutationList, observer) => {
    mutationList.forEach(async (mutation) => {
        for (const node of Array.from(mutation.addedNodes)) {
            // Inicia o Insidious caso sua tag já tenha sido adicionada.
            // Essa adição indica que o script de página já está devidamente carregado.
            if (node.nodeName === 'INSIDIOUS') {
                observer.disconnect();

                /** Determina se o Insidious está ativado. */
                const insidiousStatus = await Store.get('insidiousStatus') as boolean | undefined;
                if (insidiousStatus !== false) {
                    Assets.freeze();

                    Insidious.updateGameData()
                        .then(() => Insidious.start())
                        .catch((err: unknown) => InsidiousError.handle(err));
                };

                return;
            };
        };
    });
    

}).observe(document.head, { childList: true });

// Insere o script com acesso ao contexto da página.
new Manatsu('script', document.head, { src: browser.runtime.getURL('./page/page.js') }).create();