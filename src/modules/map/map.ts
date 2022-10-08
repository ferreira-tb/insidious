class TWMap {
    protected static readonly eventTarget: EventTarget = new EventTarget();
    // currentX e currentY são inicializados com um uso de Object.defineProperties().
    protected static readonly currentX: number;
    protected static readonly currentY: number;
    
    static async #open() {
        try {
            // Elementos originais.
            const mapLegend = document.querySelector('#map_legend');
            if (!mapLegend) throw new InsidiousError('DOM: #map_legend');

            const mapBig = document.querySelector('#map_big');
            if (!mapBig) throw new InsidiousError('DOM: #map_big');

            // Elementos da extensão.
            const menuArea = new Manatsu({ id: 'insidious_mapMenuArea' }).create();
            mapBig.insertBefore(menuArea, mapLegend);

            // Área dos botões e de suas subdivisões.
            const buttonArea = new Manatsu({ id: 'insidious_mapButtonArea' }, menuArea).create();

            // Tags.
            const tagArea = new Manatsu({ id: 'insidious_mapTagArea' }, buttonArea).create();
            new Manatsu('span', { text: 'Tags' }, tagArea).create();
            const tagsCheckbox = new Manatsu('input', {
                type: 'checkbox',
                id: 'insidious_customTags_checkbox'
            }, tagArea).create() as HTMLInputElement;

            // Filtros.
            const filterArea = new Manatsu({ id: 'insidious_mapFilterArea' }, buttonArea).create();
            new Manatsu('span', { text: 'Filtros' }, filterArea).create();
            const filtersCheckbox = new Manatsu('input', {
                type: 'checkbox',
                id: 'insidious_mapFilters_checkbox'
            }, filterArea).create() as HTMLInputElement;

            // Coordenadas.
            const coordsArea = new Manatsu(buttonArea).create();
            new Manatsu('span', { text: 'Coordenadas' }, coordsArea).create();

            // Área usada por alguns eventos para exibir resultados.
            const actionArea = new Manatsu({ id: 'insidious_mapActionArea' }).create();
            menuArea.appendChild(actionArea);

            ////// BOTÕES
            const addTagButton = (text: string) => {
                return new Manatsu('button', {
                    text: text,
                    class: 'insidious_mapButtonArea_Btn'
                }, tagArea).create();
            };

            const showPointsBtn = addTagButton('PT - Jogadores');
            const showBBPointsBtn = addTagButton('PT - Bárbaras');
            const showTimeBtn = addTagButton('Tempo');
            const showDistanceBtn = addTagButton('Distância');

            const addFilterButton = (text: string) => {
                return new Manatsu('button', {
                    text: text,
                    class: 'insidious_mapButtonArea_Btn'
                }, filterArea).create();
            };

            const showUnknownBtn = addFilterButton('Não atacadas');
            
            const getBBCoordsBtn = new Manatsu('button', {
                text: 'Bárbaras',
                class: 'insidious_mapButtonArea_Btn'
            }, coordsArea).create();

            // INFORMAÇÕES
            // Emite um erro caso não consiga identificar a aldeia atual.
            if (Insidious.currentVillageID === null) throw new InsidiousError('Não foi possível obter o ID da aldeia atual.');

            const currentVillage = await browser.storage.local.get(`v${Insidious.currentVillageID}_${Insidious.world}`);
            const { x: currentX, y: currentY }: SNObject = currentVillage[`v${Insidious.currentVillageID}_${Insidious.world}`] ?? { };
            if (currentX === undefined || currentY === undefined) {
                throw new InsidiousError(`Não foi possível obter as coordenadas da aldeia atual(${Insidious.currentVillageID}).`);
            } else {
                Object.defineProperties(this, {
                    'currentX': {
                        value: currentX,
                        enumerable: true,
                        configurable: false,
                        writable: false
                    },

                    'currentY': {
                        value: currentY,
                        enumerable: true,
                        configurable: false,
                        writable: false
                    },
                });
            };

            ////// EVENTOS
            // Tags.
            showDistanceBtn.addEventListener('click', () => MapTag.create('distance'));
            showPointsBtn.addEventListener('click', () => MapTag.create('points'));
            showBBPointsBtn.addEventListener('click', () => MapTag.create('bbpoints'));
            showTimeBtn.addEventListener('click', () => this.#showUnitIcons());
            tagsCheckbox.addEventListener('change', () => this.#toggleTags());
            
            // Filtros de mapa.
            showUnknownBtn.addEventListener('click', () => MapFilter.create('bbunknown'));
            filtersCheckbox.addEventListener('change', () => this.#toggleFilters());

            // Coleta as coordenadas das aldeias bárbaras.
            getBBCoordsBtn.addEventListener('click', () => this.#getBBCoords());

            // CONFIGURAÇÕES
            const menuAreaOptionList = [
                [`customTagStatus_${Insidious.world}`, `lastCustomTag_${Insidious.world}`], // TAGS
                [`mapFiltersStatus_${Insidious.world}`, `lastMapFilter_${Insidious.world}`]  // FILTROS
            ];

            // Ativa a última tag e o último filtro utilizados (caso estejam habilitados).
            Promise.all(menuAreaOptionList.map((item) => {
                return new Promise<void>(async (resolve) => {
                    const itemStatus: SSObject = await browser.storage.local.get(item[0]);
                    if (itemStatus[item[0]] === 'disabled') {
                        switch (item[0]) {
                            case `customTagStatus_${Insidious.world}`: Manatsu.disableChildren(tagArea, 'button');
                                break;
                            case `mapFiltersStatus_${Insidious.world}`: Manatsu.disableChildren(filterArea, 'button');
                                break;
                        };

                        // O resto deve do código deve estar separado, pois resolve() não é como um return.
                        // A função continua executando mesmo após a promise estar concluída.
                        resolve();

                    } else {
                        const lastItem: SSObject = await browser.storage.local.get(item[1]);
                        if (!lastItem[item[1]]) {
                            resolve();
                            return;
                        };
    
                        // O jogo comumente demora a carregar o #map_container, o que impede o trabalho da função.
                        if (!document.querySelector('#map_container')) {
                            const containerStatus = await new Promise<boolean>((resolve) => {
                                setTimeout(() => {
                                    // Caso #map_container ainda não exista, rejeita a promise.
                                    // Isso porquê o problema pode já não ser relacionado ao carregamento da página.
                                    if (!document.querySelector('#map_container')) {
                                        resolve(false);
                                    } else {
                                        resolve(true);
                                    };                                  
                                }, 500);
                            });
    
                            if (containerStatus === false) throw new InsidiousError('DOM: #map_container');
                        };

                        switch (item[1]) {
                            case `lastCustomTag_${Insidious.world}`:
                                const tagsCheckbox = document.querySelector('#insidious_customTags_checkbox');
                                if (!tagsCheckbox) throw new InsidiousError('A checkbox da área de tags não está presente.');
                                (tagsCheckbox as HTMLInputElement).checked = true;
                                MapTag.create(lastItem[`lastCustomTag_${Insidious.world}`] as TagType);
                                break;

                            case `lastMapFilter_${Insidious.world}`:
                                const filtersCheckbox = document.querySelector('#insidious_mapFilters_checkbox');
                                if (!filtersCheckbox) throw new InsidiousError('A checkbox da área de filtros não está presente.');
                                (filtersCheckbox as HTMLInputElement).checked = true;
                                MapFilter.create(lastItem[`lastMapFilter_${Insidious.world}`] as FilterType);
                                break;
                        };

                        resolve();
                    };
                });

            })).catch((err: unknown) => {
                if (err instanceof Error) console.error(err);
            });
            
        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static #clearActionArea() {
        const actionArea = document.querySelector('#insidious_mapActionArea');
        if (!actionArea) throw new InsidiousError('DOM: #insidious_mapActionArea');

        this.eventTarget.dispatchEvent(new Event('clearactionarea'));
        Manatsu.removeChildren(actionArea);
    };

    static async #toggleTags() {
        const tagsCheckbox = document.querySelector('#insidious_customTags_checkbox') as HTMLInputElement;
        if (!tagsCheckbox) throw new InsidiousError('DOM: #insidious_customTags_checkbox');

        const tagArea = document.querySelector('#insidious_mapTagArea');
        if (!tagArea) throw new InsidiousError('DOM: #insidious_mapTagArea');

        if (tagsCheckbox.checked) {
            await browser.storage.local.set({ [`customTagStatus_${Insidious.world}`]: 'enabled' });
            Manatsu.enableChildren(tagArea, 'button');

            const lastTag: { [index: string]: TagType } = await browser.storage.local.get(`lastCustomTag_${Insidious.world}`);
            if (lastTag?.[`lastCustomTag_${Insidious.world}`]) MapTag.create(lastTag[`lastCustomTag_${Insidious.world}`]);
            
        } else {
            await browser.storage.local.set({ [`customTagStatus_${Insidious.world}`]: 'disabled' });
            Manatsu.disableChildren(tagArea, 'button');

            // Interrompe observers que possam estar ativos.
            this.eventTarget.dispatchEvent(new Event('stoptagobserver'));

            // Remove todas as tags.
            const oldCustomTags = document.querySelectorAll('.insidious_map_villageCustomTag');
            oldCustomTags.forEach((customTag) => customTag.parentNode?.removeChild(customTag));
        };
    };

    static async #showUnitIcons() {
        try {
            const actionArea = document.querySelector('#insidious_mapActionArea');
            if (!actionArea) throw new InsidiousError('DOM: #insidious_mapActionArea');

            if (!Insidious.worldInfo[`config_${Insidious.world}`].game) {
                await browser.storage.local.remove(`worldConfigFetch_${Insidious.world}`);
                throw new InsidiousError('Não foi possível obter as configurações do mundo.');
            };

            this.#clearActionArea();
            const imgIconCtrl = new AbortController();
            this.eventTarget.addEventListener('clearactionarea', () => {
                imgIconCtrl.abort();
            }, { signal: imgIconCtrl.signal });

            const isThereArchers = () => {
                switch (Insidious.worldInfo[`config_${Insidious.world}`].game.archer) {
                    case 0: return TWAssets.list.all_units;
                    case 1: return TWAssets.list.all_units_archer;
                    default: return TWAssets.list.all_units;
                };
            };

            isThereArchers().forEach((unit: UnitList) => {
                const imgIcon = new Manatsu('img', {
                    src: TWAssets.image[`${unit}_18`],
                    style: 'cursor: pointer; margin-right: 5px;',
                    ['insidious-custom']: 'true'
                }, actionArea).create();

                imgIcon.addEventListener('click', () => {
                    imgIconCtrl.abort();
                    this.#clearActionArea();
                    MapTag.create(`time_${unit}`);
                }, { signal: imgIconCtrl.signal });
            });

        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static async #toggleFilters() {
        const filtersCheckbox = document.querySelector('#insidious_mapFilters_checkbox') as HTMLInputElement;
        if (!filtersCheckbox) throw new InsidiousError('DOM: #insidious_mapFilters_checkbox');

        const filterArea = document.querySelector('#insidious_mapFilterArea');
        if (!filterArea) throw new InsidiousError('DOM: #insidious_mapFilterArea');

        if (filtersCheckbox.checked) {
            await browser.storage.local.set({ [`mapFiltersStatus_${Insidious.world}`]: 'enabled' });
            Manatsu.enableChildren(filterArea, 'button');

            const lastFilter: { [index: string]: FilterType } = await browser.storage.local.get(`lastMapFilter_${Insidious.world}`);
            if (lastFilter[`lastMapFilter_${Insidious.world}`]) MapFilter.create(lastFilter[`lastMapFilter_${Insidious.world}`]);
            
        } else {
            await browser.storage.local.set({ [`mapFiltersStatus_${Insidious.world}`]: 'disabled' });
            Manatsu.disableChildren(filterArea, 'button');

            // Interrompe observers que possam estar ativos.
            this.eventTarget.dispatchEvent(new Event('stopfilterobserver'));

            // Remove todos os filtros.
            const oldFilters = document.querySelectorAll('[insidious-map-filter]');
            oldFilters.forEach((filteredElem) => {
                filteredElem.removeAttribute('insidious-map-filter');
                filteredElem.removeAttribute('insidious-filter-type');
            });
        };
    };

    static #getBBCoords() {
        const actionArea = document.querySelector('#insidious_mapActionArea');
        if (!actionArea) throw new InsidiousError('DOM: #insidious_mapActionArea');
        this.#clearActionArea();

        const getBBCoordsCtrl = new AbortController();
        this.eventTarget.addEventListener('clearactionarea', () => {
            getBBCoordsCtrl.abort();
        }, { signal: getBBCoordsCtrl.signal });

        actionArea.addEventListener('mouseover', (e) => {
            e.stopPropagation();
            const coordClass = (e.target as Element).getAttribute('class');
            if (coordClass === 'insidious_mapActionArea_coords') {
                try {
                    const villageID = (e.target as Element).id.replace(/\D/g, '');
                    const villageElement = document.querySelector(`#map_village_${villageID}`);
                    if (!villageElement) return;

                    if (!villageElement.hasAttribute('class')) {
                        villageElement.setAttribute('class', 'insidious_map_glow');     
                    } else {
                        throw new InsidiousError(`DOM: .${villageElement.getAttribute('class')}`);
                    };

                } catch (err) {
                    if (err instanceof Error) console.error(err);
                };
            };
        }, { signal: getBBCoordsCtrl.signal });

        actionArea.addEventListener('mouseout', (e) => {
            e.stopPropagation();
            const coordClass = (e.target as Element).getAttribute('class');
            if (coordClass === 'insidious_mapActionArea_coords') {
                try {
                    let villageID: string | null = (e.target as Element).getAttribute('id');
                    if (villageID === null) throw new InsidiousError('Não foi possível obter o ID relacionado a essa aldeia.');
                    villageID = villageID.replace(/\D/g, '');

                    const villageElement = document.querySelector('#map_village_' + villageID);
                    if (!villageElement) return;

                    const villageClass = villageElement.getAttribute('class');
                    if (villageClass === 'insidious_map_glow') {
                        villageElement.removeAttribute('class');
                    } else if (villageClass !== null) {
                        throw new InsidiousError(`DOM: ${villageClass}`);
                    };

                } catch (err) {
                    if (err instanceof Error) console.error(err);
                };
            };
        }, { signal: getBBCoordsCtrl.signal });
        
        // Vasculha os elementos do mapa e retorna aqueles que representam aldeias bárbaras.
        Promise.allSettled(Array.from(this.getVillagesID()).map((id: string) => {
            return new Promise<void>(async (resolve, reject) => {
                try {
                    const village = `v${id}_${Insidious.world}`;
                    const result = await browser.storage.local.get(village);
                    if (!result[village]) throw new InsidiousError(`Aldeia não encontrada no registro: ${village}`);

                    if (result[village].player === 0) {
                        const coords = document.createElement('span');
                        coords.setAttribute('class', 'insidious_mapActionArea_coords');
                        coords.setAttribute('id', 'insidious_mapActionArea_' + 'village' + id);
                        coords.textContent = `${result[village].x}\|${result[village].y}`;
                        actionArea.appendChild(coords);
                    };

                    resolve();

                } catch (err) {
                    reject(err);
                };
            });
        }));
    };

    protected static getVillagesID(): Set<string> {
        const villages: Set<string> = new Set();
        const mapImages = document.querySelectorAll('#map_container div img[id^="map_village_"]:not([id*="undefined"])');
        mapImages.forEach((img) => {
            const imgID = img.getAttribute('id');
            if (imgID === null || imgID === '') return;
            villages.add(imgID.replace(/\D/g, ''));
        });

        return villages;
    };

    static get open() { return this.#open };
};