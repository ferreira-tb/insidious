class MapFilter extends TWMap {
    /** Chave para obter o status atual dos filtros de mapa (mapFiltersStatus). */
    static readonly key = `mapFiltersStatus_${Insidious.world}`;
    /** Chave para obter o último filtro utilizado no mapa (lastMapFilter). */
    static readonly lastKey = `lastMapFilter_${Insidious.world}`;

    static async create(filterType: FilterType) {
        // Desconecta qualquer observer de filtro que esteja ativo no mapa.
        this.eventTarget.dispatchEvent(new Event('stopfilterobserver'));

        if (await Store.get(this.key) === false) return;

        // Oculta as aldeias de convite.
        this.hideUndefinedVillages();

        // Salva o último filtro utilizado.
        Store.set({ [this.lastKey]: filterType })
            .catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });

        // Vasculha os elementos do mapa e retorna aqueles que são aldeias.  
        const mapVillages: Set<string> = this.getVillagesID();
        // Em seguida, analisa os filtros possivelmente presentes.
        const filteredElements = document.querySelectorAll('[insidious-filter-type]');
        if (filteredElements.length > 0) {
            filteredElements.forEach((filtered) => {
                const previousFilterType = filtered.getAttribute('insidious-filter-type');
                if (!previousFilterType) return;
                // Filtros de outros tipos são removidos para o escolhido poder ser aplicado.
                if (previousFilterType !== filterType) {
                    filtered.removeAttribute('insidious-filter-type');
                    filtered.removeAttribute('insidious-map-filter');

                // Não inclui na lista as aldeias que já possuem o filtro escolhido.
                } else {
                    const elementID = filtered.getAttribute('id');
                    if (elementID && elementID.startsWith('map_village_')) {
                        mapVillages.delete(elementID.replace(/\D/g, ''));
                    };
                };
            });
        };

        // Guarda informações que serão usadas pelas promises.
        let filterContext: FilterContext;
        if (filterType === 'bbunknown') {
            const attackHistory = await Store.get(Plunder.plunderedKey) as Set<string> | undefined;
            // Se não há aldeias registradas no banco de dados, não há o que filtrar.
            if (attackHistory === undefined) return;
            filterContext = attackHistory;

            // Adiciona aldeias que estejam sendo atacadas.
            // Isso permite que as aldeias não registradas sejam ocultas logo após um ataque ser enviado a elas.
            mapVillages.forEach((value: string) => {
                if (document.querySelector(`img[id^="map_cmdicons_${value}"]`)) (filterContext as Set<string>).add(value);
            });
        };

        // Adiciona os filtros.
        Promise.allSettled(Array.from(mapVillages).map((id: string) => {
            return new Promise<void>(async (resolve, reject) => {
                if (id === Insidious.village) {
                    reject();
                    return;
                };

                try {
                    const village = `v${id}_${Insidious.world}`;
                    const villageData = await Store.get(village) as VillageInfo | undefined;

                    const villageElement = document.querySelector(`#map_village_${id}`);
                    if (!villageElement) throw new InsidiousError(`DOM: #map_village_${id}`);

                    const villageParent = villageElement.parentElement;
                    if (!villageParent) throw new InsidiousError(`O elemento pai não foi encontrado (${id}).`);

                    const getCanvas = (): HTMLCanvasElement | null => {
                        const elementStyle: string | null = villageElement.getAttribute('style');
                        if (!elementStyle) throw new InsidiousError(`Não foi possível encontrar a tag de estilo em \"villageElement\" (${id}).`);

                        let leftTopStyle: string[] = elementStyle.split(';').filter((property) => {
                            if (property.includes('left:') || property.includes('top:')) return true;
                            return false;
                        });

                        leftTopStyle = leftTopStyle.map((item) => item.trim());

                        const canvasList = villageParent.querySelectorAll('canvas');
                        for (const canvas of Array.from(canvasList)) {
                            const canvasStyle = canvas.getAttribute('style');
                            if (canvasStyle === null) continue;

                            if (canvasStyle.includes(leftTopStyle[0]) && canvasStyle.includes(leftTopStyle[1])) {
                                return canvas;
                            };
                        };

                        return null;
                    };

                    const isThisVillageRegistered = (): boolean => {
                        if (villageData) {
                            switch (filterType) {
                                case 'bbunknown': return villageData.player !== 0;
                                default: return false;
                            };

                        } else {
                            return false;
                        };
                    };

                    // Se a aldeia já tenha sido atacada ou seja de jogador, esconde-a.
                    if (filterType === 'bbunknown' && ((filterContext as Set<string>).has(id) || isThisVillageRegistered())) {
                        this.hideMapItem(villageElement, filterType);
                        // Em seguida, busca outros elementos que tenham relação com essa aldeia e os esconde também.
                        const relatedElements = villageParent.querySelectorAll(`[id*="${id}"]:not([id^="map_village_"])`);
                        if (relatedElements.length > 0) relatedElements.forEach((element) => this.hideMapItem(element, filterType));

                        // Verifica se há algum canvas relacionado à aldeia.
                        const canvasElement = getCanvas();
                        if (canvasElement !== null) this.hideMapItem(canvasElement, filterType);

                        // Caso o elemento possua alguma tag, oculta-a também.
                        const relatedTag = villageParent.querySelector(`div.insidious_map_villageCustomTag[insidious-village="${id}"]`);
                        if (relatedTag) this.hideMapItem(relatedTag, filterType);
                    };

                    resolve();

                } catch (err) {
                    reject(err);
                };
            });
        }));

        const mapContainer = document.querySelector('#map_container');
        if (!mapContainer) throw new InsidiousError('DOM: #map_container');

        // Verifica se houve mudança no DOM decorrente da movimentação do mapa.
        // Em caso positivo, dispara a função novamente.
        const observeFilter = new MutationObserver(() => this.create(filterType));
        observeFilter.observe(mapContainer, { subtree: true, childList: true });

        const mapFiltersCtrl = new AbortController();
        this.eventTarget.addEventListener('stopfilterobserver', () => {
            observeFilter.disconnect();
            mapFiltersCtrl.abort();
        }, { signal: mapFiltersCtrl.signal });
    };

    private static hideMapItem(elementToHide: Element, filterType: FilterType) {
        if (!elementToHide) throw new InsidiousError('Não foi possível ocultar o elemento.');
        elementToHide.setAttribute('insidious-map-filter', 'hidden');
        elementToHide.setAttribute('insidious-filter-type', filterType);
    };

    private static hideUndefinedVillages(): void {
        const mapContainer = document.querySelector('#map_container');
        if (!mapContainer) throw new InsidiousError('DOM: #map_container');

        const undefinedVillages = mapContainer.querySelectorAll('#map_village_undefined');
        undefinedVillages.forEach((unVillage) => {
            if (!unVillage.hasAttribute('insidious-map-filter')) {
                unVillage.setAttribute('insidious-map-filter', 'hidden');
            };
        });
    };
};