// Precisa sempre ser o último arquivo na lista do manifesto.
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
document.head.appendManatsu('script', { src: browser.runtime.getURL('./lib/manatsu.js') });
document.head.appendManatsu('script', { src: browser.runtime.getURL('./page/page.js') });