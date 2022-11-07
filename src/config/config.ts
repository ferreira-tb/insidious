class InsidiousConfig {
    /** CHAVE: último mundo acessado pelo jogador (lastWorld). */
    static readonly lastWorldKey = 'lastWorld';
    /** CHAVE: mundos nos quais o jogador está ativo (activeWorlds). */
    static readonly activeWorldsKey = 'activeWorlds';

    static async start() {
        try {
            const activeWorlds = await Store.get(this.activeWorldsKey) as StandardObject<number> ?? { };
            const activeWorldsEntries = Object.entries(activeWorlds);
            if (activeWorldsEntries.length > 0) {
                const div = document.querySelector('#active-worlds') as HTMLDivElement;
                div.textContent = 'Mundos ativos: '

                const worldSelection = new Manatsu('select', div, { id: 'world-selection' }).create() as HTMLSelectElement;
                worldSelection.addEventListener('change', () => this.showWorldInfo(worldSelection.value));

                for (const [key, value] of activeWorldsEntries) {
                    // Se o último acesso foi há mais de um mês, remove-o do mapa.
                    if (Date.now() - value > 2629800000) {
                        delete activeWorlds[key];
                        continue;

                    } else {
                        new Manatsu('option', worldSelection, { value: key, label: key }).create();
                    };
                };

                Store.set({ [this.activeWorldsKey]: activeWorlds })
                    .catch((err: unknown) => {
                        if (err instanceof Error) InsidiousError.handle(err, 'config');
                    });
            };

            const lastWorld = await Store.get(this.lastWorldKey) as string | undefined;
            if (lastWorld && activeWorlds[lastWorld]) {
                const lastAcess = new Date(activeWorlds[lastWorld]);
                const lastAcessDate = lastAcess.toLocaleDateString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' });
                const lastAcessHour = lastAcess.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' });

                const lastAcessInfo = `em ${lastAcessDate} às ${lastAcessHour}`;
                document.querySelector('#last-world-name')!.textContent = `Último acessado: ${lastWorld} ${lastAcessInfo}`;
                
                await this.showWorldInfo(lastWorld);
                document.querySelector(`#world-selection option[value="${lastWorld}"]`)?.setAttribute('selected', 'true');
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err, 'config');
        };
    };

    /** Exibe informações sobre o mundo selecionado. */
    private static async showWorldInfo(world: string) {
        try {
            let globalPlundered = await Store.get(`globalPlundered_${world}`) as TotalPlundered | undefined;
            if (!globalPlundered) globalPlundered = { wood: 0, stone: 0, iron: 0, total: 0, attack_amount: 0 };

            /** Recursos saqueados. */
            const resourcesDiv = document.querySelector('#global-plunder-resources') as HTMLDivElement;
            Manatsu.removeChildren(resourcesDiv);

            for (const [key, value] of Object.entries(globalPlundered) as TotalPlunderedEntries) {
                if (!Number.isInteger(value)) throw new InsidiousError('O valor em \"globalPlundered\" é inválido.');
                const amount = value.toLocaleString('pt-br');
                if (key === 'attack_amount') {
                    document.querySelector('#global-plunder-attack')!.textContent = `Ataques enviados: ${amount}`;
                } else if (key !== 'total') {
                    if (!resourcesDiv.firstElementChild) new Manatsu('span', resourcesDiv, { text: 'Recursos saqueados: ' }).create();
                    new Manatsu('span', resourcesDiv, { class: `icon ${key}` }).create();
                    new Manatsu('span', resourcesDiv, { text: amount, style: 'margin-right: 5px;' }).create();
                };
            };

            new Manatsu('span', resourcesDiv, { class: 'icon storage' }).create();
            new Manatsu('span', resourcesDiv, { text: globalPlundered.total.toLocaleString('pt-br') }).create();

            const wallDiv = document.querySelector('#global-plunder-wall') as HTMLDivElement;
            Manatsu.removeChildren(wallDiv);
            wallDiv.textContent = 'Muralhas destruídas: ';

            /** Muralhas destruídas. */
            let destroyedWalls = await Store.get(`plunderDestroyedWalls_${world}`) as number | undefined;
            if (!destroyedWalls) destroyedWalls = 0;

            new Manatsu('span', wallDiv, { class: 'icon wall' }).create();
            new Manatsu('span', wallDiv, { text: destroyedWalls.toLocaleString('pt-br') }).create();

            /** Atualiza as informações sobre o mundo. */
            const updateWorldInfoButton = document.querySelector('#update-plunder-info') as HTMLButtonElement;
            updateWorldInfoButton.setAttribute('style', 'visibility: visible;');

            const updateCtrl = new AbortController();
            updateWorldInfoButton.addEventListener('click', () => {
                updateCtrl.abort();
                this.showWorldInfo(world);
            }, { signal: updateCtrl.signal });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err, 'config');
        };
    };
};

InsidiousConfig.start();