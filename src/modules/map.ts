class TWMap {
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

            const tagArea = new Manatsu(buttonArea).create();
            new Manatsu('span', { text: 'Tags' }, tagArea).create();
            const toggleTags = new Manatsu('input', {
                type: 'checkbox',
                id: 'insidious_customTags_checkbox'
            }, tagArea).create();

            const filterArea = new Manatsu(buttonArea).create();
            new Manatsu('span', { text: 'Filtros' }, filterArea).create();
            const toggleFilters = new Manatsu('input', {
                type: 'checkbox',
                id: 'insidious_mapFilters_checkbox'
            }, filterArea).create();

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
            const currentVillageID: string | null = Utils.currentVillage();
            if (currentVillageID === null) throw new InsidiousError('Não foi possível obter o ID da aldeia atual.');
            const currentVillage = await browser.storage.local.get('village' + currentVillageID);

            const { x: currentX, y: currentY }: SNObject = currentVillage['village' + currentVillageID] ?? { };
            if (currentX === undefined || currentY === undefined) {
                throw new InsidiousError(`Não foi possível obter as coordenadas da aldeia atual ${currentVillageID}.`);
            };

            ////// FUNÇÕES
            const mapEventTarget = new EventTarget();

            const clearActionArea = () => {
                mapEventTarget.dispatchEvent(new Event('clearactionarea'));
                Manatsu.removeChildren(actionArea);
            };

            const addCustomTags = async (tagType: string) => {
                // Desconecta qualquer observer de tag que esteja ativo no mapa.
                mapEventTarget.dispatchEvent(new Event('stoptagobserver'));

                const tagStatus = await browser.storage.local.get('customTagStatus');
                if (tagStatus.customTagStatus === 'disabled') return;

                // Salva a última tag utilizada, para que seja ativada automaticamente na próxima vez.
                browser.storage.local.set({ lastCustomTag: tagType })
                    .catch((err: unknown) => {
                        if (err instanceof Error) console.error(err);
                    });

                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
                const mapVillages: Set<string> = this.#getVillagesID();
                // Em seguida, analisa as tags possivelmente presentes.
                const oldCustomTags = document.querySelectorAll('.insidious_map_villageCustomTag');
                if (oldCustomTags.length > 0) {
                    oldCustomTags.forEach((customTag) => {
                        const previousTagType = customTag.getAttribute('insidious-tag-type');
                        if (!previousTagType) return;
                        // Tags de outros tipos são removidas para a escolhida poder ser aplicada.
                        if (previousTagType !== tagType) {
                            customTag.parentNode?.removeChild(customTag);
                        
                        // Não inclui na lista as aldeias que já possuem a tag escolhida.
                        } else {
                            const oldVillageID = customTag.getAttribute('insidious-village');
                            if (oldVillageID !== null) mapVillages.delete(oldVillageID);
                        };
                    });
                };

                // Adiciona as novas tags.
                Promise.allSettled(Array.from(mapVillages).map((id: string) => {
                    return new Promise<void>(async (resolve, reject) => {
                        if (id === currentVillageID) {
                            reject();
                            return;
                        };

                        try {
                            const village = 'village' + id;
                            const result: VillageQuery = await browser.storage.local.get(village);
                            if (!result[village]) throw new InsidiousError(`Aldeia não encontrada no registro (${id}).`);

                            const { x: targetX, y: targetY } = result[village];
                            if (targetX === undefined || targetY === undefined) {
                                throw new InsidiousError(`Não foi possível obter as coordenadas da aldeia alvo ${id}.`);
                            };

                            const villageCustomTag = new Manatsu({
                                class: 'insidious_map_villageCustomTag',
                                ['insidious-tag-type']: tagType,
                                ['insidious-village']: id
                            }).create();

                            const villageElement = document.querySelector(`#map_village_${id}`);
                            if (!villageElement) throw new InsidiousError(`DOM: #map_village_${id}`);

                            const elementStyle: string | null = villageElement.getAttribute('style');
                            if (!elementStyle) throw new InsidiousError(`Não foi possível encontrar a tag de estilo em \"villageElement\" (${id}).`);

                            const leftTopStyle: string[] = elementStyle.split(';').filter((property) => {
                                if (property.includes('left:') || property.includes('top:')) return true;
                                return false;
                            });

                            if (leftTopStyle.length > 0) {
                                const adjustTop = () => {
                                    let topValue = leftTopStyle[0].includes('top') ? leftTopStyle[0] : leftTopStyle[1];
                                    topValue = topValue.replace('top:', '').replace('px', '').trim();
                                    return `top: ${String(Number(topValue) + 20)}px;`;
                                };

                                const adjustLeft = () => {
                                    let leftValue = leftTopStyle[0].includes('left') ? leftTopStyle[0] : leftTopStyle[1];
                                    return ` ${leftValue};`;
                                };

                                const elementPosition = adjustTop().concat(adjustLeft());
                                villageCustomTag.setAttribute('style', elementPosition);

                                if (!villageElement.parentNode) throw new InsidiousError(`Não foi possível encontrar o elemento pai de \"villageElement\" (${id}).`);
                                villageElement.parentNode.insertBefore(villageCustomTag, villageElement);

                            } else {
                                throw new InsidiousError(`Não existem \"left\" e \"top\" entre os elementos de \"villageElement\" (${id})`);
                            };

                            const getRelativeCoords = (): number[] => {
                                const coords: number[] = [currentX, currentY, targetX, targetY];
                                if (coords.some(coord => !Number.isInteger(coord))) {
                                    throw new InsidiousError(`As coordenadas obtidas são inválidas (${currentVillageID} e/ou ${id}).`);
                                };
                                return coords;
                            };

                            if (tagType === 'distance') {
                                const distance = Utils.calcDistance(...getRelativeCoords());
                                villageCustomTag.textContent = distance.toFixed(1);

                            } else if (tagType === 'points') {
                                if (!result[village].points) throw new InsidiousError(`Aldeia não encontrada no registro (${id}).`);
                                if (result[village].player !== 0) villageCustomTag.textContent = String(result[village].points);

                            } else if (tagType === 'bbpoints') {
                                if (!result[village].points) throw new InsidiousError(`Aldeia não encontrada no registro (${id}).`);
                                if (result[village].player === 0) villageCustomTag.textContent = String(result[village].points);

                            } else if (tagType.startsWith('time_')) {
                                const unitName = tagType.replace('time_', '');
                                if (!Insidious.unitInfo.unit || !Insidious.worldInfo.config) {
                                    browser.storage.local.remove('worldConfigFetch');
                                    throw new InsidiousError('Não foi possível obter as configurações do mundo.');
                                };

                                const millisecondsPerField = 60000 * (Insidious.unitInfo.unit[unitName].speed * Insidious.worldInfo.config.unit_speed);
                                const fieldAmount = Utils.calcDistance(...getRelativeCoords());
                                const travelTime = millisecondsPerField * fieldAmount;

                                const getFullHours = () => {
                                    // É necessário usar Math.trunc(), pois toFixed() arredonda o número.
                                    let hours = String(Math.trunc(travelTime / 3600000));
                                    let remainder = travelTime % 3600000;
                                    if (hours.length === 1) hours = hours.padStart(2, '0');

                                    let minutes = String(Math.trunc(remainder / 60000));
                                    remainder = remainder % 60000;
                                    if (minutes.length === 1) minutes = minutes.padStart(2, '0');

                                    // No entanto, no caso dos segundos, o arredondamento é desejado.
                                    let seconds = (remainder / 1000).toFixed(0);
                                    if (seconds.length === 1) seconds = seconds.padStart(2, '0');

                                    return `${hours}:${minutes}:${seconds}`;
                                };

                                villageCustomTag.textContent = getFullHours();
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
                const observeTag = new MutationObserver(() => addCustomTags(tagType));
                observeTag.observe(mapContainer, { subtree: true, childList: true });

                const customTagsCtrl = new AbortController();
                mapEventTarget.addEventListener('stoptagobserver', () => {
                    observeTag.disconnect();
                    customTagsCtrl.abort();
                }, { signal: customTagsCtrl.signal });
            };

            const addMapFilters = async (filterType: string) => {
                // Desconecta qualquer observer de filtro que esteja ativo no mapa.
                mapEventTarget.dispatchEvent(new Event('stopfilterobserver'));

                const filterStatus = await browser.storage.local.get('mapFiltersStatus');
                if (filterStatus.mapFiltersStatus === 'disabled') return;

                // Oculta as aldeias de convite.
                this.#hideUndefinedVillages();

                // Salva o último filtro utilizado.
                browser.storage.local.set({ lastMapFilter: filterType })
                    .catch((err: unknown) => {
                        if (err instanceof Error) console.error(err);
                    });


                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.  
                const mapVillages: Set<string> = this.#getVillagesID();
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
                                mapVillages.delete(elementID.replace('map_village_', ''));
                            };
                        };
                    });
                };

                // Guarda informações que serão usadas pelas promises.
                let filterContext: FilterContext;
                if (filterType === 'bbunknown') {
                    const attackHistory: Set<string> | undefined = (await browser.storage.local.get('alreadyPlunderedVillages')).alreadyPlunderedVillages;
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
                        if (id === currentVillageID) {
                            reject();
                            return;
                        };

                        try {
                            const village = 'village' + id;
                            const result: VillageQuery = await browser.storage.local.get(village);

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
                                for (const canvas of (canvasList as unknown) as HTMLCanvasElement[]) {
                                    const canvasStyle = canvas.getAttribute('style');
                                    if (canvasStyle === null) continue;

                                    if (canvasStyle.includes(leftTopStyle[0]) && canvasStyle.includes(leftTopStyle[1])) {
                                        return canvas;
                                    };
                                };

                                return null;
                            };

                            const isThisVillageRegistered = (): boolean => {
                                if (result[village]) {
                                    switch (filterType) {
                                        case 'bbunknown': return result[village].player !== 0;
                                        default: return false;
                                    };
   
                                } else {
                                    return false;
                                };
                            };

                            // Se a aldeia já tenha sido atacada ou seja de jogador, esconde-a.
                            if (filterType === 'bbunknown' && ((filterContext as Set<string>).has(id) || isThisVillageRegistered())) {
                                hideMapItem(villageElement);
                                // Em seguida, busca outros elementos que tenham relação com essa aldeia e os esconde também.
                                const relatedElements = villageParent.querySelectorAll(`[id*="${id}"]:not([id^="map_village_"])`);
                                if (relatedElements.length > 0) relatedElements.forEach((element) => hideMapItem(element));

                                // Verifica se há algum canvas relacionado à aldeia.
                                const canvasElement = getCanvas();
                                if (canvasElement !== null) hideMapItem(canvasElement);

                                // Caso o elemento possua alguma tag, oculta-a também.
                                const relatedTag = villageParent.querySelector(`div.insidious_map_villageCustomTag[insidious-village="${id}"]`);
                                if (relatedTag) hideMapItem(relatedTag);
                            };

                            resolve();

                        } catch (err) {
                            reject(err);
                        };
                    });
                }));
                
                function hideMapItem(elementToHide: Element) {
                    if (!elementToHide) throw new InsidiousError('Não foi possível ocultar o elemento.');
                    elementToHide.setAttribute('insidious-map-filter', 'hidden');
                    elementToHide.setAttribute('insidious-filter-type', filterType);
                };

                const mapContainer = document.querySelector('#map_container');
                if (!mapContainer) throw new InsidiousError('DOM: #map_container');

                // Verifica se houve mudança no DOM decorrente da movimentação do mapa.
                // Em caso positivo, dispara a função novamente.
                const observeFilter = new MutationObserver(() => addMapFilters(filterType));
                observeFilter.observe(mapContainer, { subtree: true, childList: true });

                const mapFiltersCtrl = new AbortController();
                mapEventTarget.addEventListener('stopfilterobserver', () => {
                    observeFilter.disconnect();
                    mapFiltersCtrl.abort();
                }, { signal: mapFiltersCtrl.signal });
            };

            ////// EVENTOS
            // Tags.
            showDistanceBtn.addEventListener('click', () => addCustomTags('distance'));
            showPointsBtn.addEventListener('click', () => addCustomTags('points'));
            showBBPointsBtn.addEventListener('click', () => addCustomTags('bbpoints'));

            toggleTags.addEventListener('change', async () => {
                if ((toggleTags as HTMLInputElement).checked) {
                    await browser.storage.local.set({ customTagStatus: 'enabled' });
                    Manatsu.enableChildren(tagArea, 'button');

                    const lastTag: { lastCustomTag: string } = await browser.storage.local.get('lastCustomTag');
                    if (lastTag?.lastCustomTag) addCustomTags(lastTag.lastCustomTag);
                    
                } else {
                    await browser.storage.local.set({ customTagStatus: 'disabled' });
                    Manatsu.disableChildren(tagArea, 'button');

                    // Interrompe observers que possam estar ativos.
                    mapEventTarget.dispatchEvent(new Event('stoptagobserver'));

                    // Remove todas as tags.
                    const oldCustomTags = document.querySelectorAll('.insidious_map_villageCustomTag');
                    oldCustomTags.forEach((customTag) => customTag.parentNode?.removeChild(customTag));
                };
            });

            showTimeBtn.addEventListener('click', async () => {
                try {
                    if (!Insidious.worldInfo.config.game) {
                        await browser.storage.local.remove('worldConfigFetch');
                        throw new InsidiousError('Não foi possível obter as configurações do mundo.');
                    };

                    clearActionArea();
                    const imgIconCtrl = new AbortController();
                    mapEventTarget.addEventListener('clearactionarea', () => {
                        imgIconCtrl.abort();
                    }, { signal: imgIconCtrl.signal });

                    const isThereArchers = () => {
                        switch (Insidious.worldInfo.config.game.archer) {
                            case 0: return TWAssets.list.all_units;
                            case 1: return TWAssets.list.all_units_archer;
                            default: return TWAssets.list.all_units;
                        };
                    };
    
                    isThereArchers().forEach((unit: IconImgName) => {
                        const imgIcon = new Manatsu('img', {
                            src: TWAssets.image[`${unit}_18`],
                            style: 'cursor: pointer; margin-right: 5px;',
                            ['insidious-custom']: 'true'
                        }, actionArea).create();
    
                        imgIcon.addEventListener('click', () => {
                            imgIconCtrl.abort();
                            clearActionArea();
                            addCustomTags('time_' + unit);
                        }, { signal: imgIconCtrl.signal });
                    });

                } catch (err) {
                    if (err instanceof Error) console.error(err);
                };
            });

            // Filtros de mapa.
            showUnknownBtn.addEventListener('click', () => addMapFilters('bbunknown'));

            toggleFilters.addEventListener('change', async () => {
                if ((toggleFilters as HTMLInputElement).checked) {
                    await browser.storage.local.set({ mapFiltersStatus: 'enabled' });
                    Manatsu.enableChildren(filterArea, 'button');

                    const lastFilter: { lastMapFilter: string } = await browser.storage.local.get('lastMapFilter');
                    if (lastFilter.lastMapFilter) addMapFilters(lastFilter.lastMapFilter);
                    
                } else {
                    await browser.storage.local.set({ mapFiltersStatus: 'disabled' });
                    Manatsu.disableChildren(filterArea, 'button');

                    // Interrompe observers que possam estar ativos.
                    mapEventTarget.dispatchEvent(new Event('stopfilterobserver'));

                    // Remove todos os filtros.
                    const oldFilters = document.querySelectorAll('[insidious-map-filter]');
                    oldFilters.forEach((filteredElem) => {
                        filteredElem.removeAttribute('insidious-map-filter');
                        filteredElem.removeAttribute('insidious-filter-type');
                    });
                };
            });

            // Coleta as coordenadas das aldeias bárbaras.
            getBBCoordsBtn.addEventListener('click', () => {
                clearActionArea();

                const getBBCoordsCtrl = new AbortController();
                mapEventTarget.addEventListener('clearactionarea', () => {
                    getBBCoordsCtrl.abort();
                }, { signal: getBBCoordsCtrl.signal });

                actionArea.addEventListener('mouseover', (e) => {
                    e.stopPropagation();
                    const coordClass = (e.target as Element).getAttribute('class');
                    if (coordClass === 'insidious_mapActionArea_coords') {
                        try {
                            const villageID = (e.target as Element).id.replace('insidious_mapActionArea_village', '');
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
                            villageID = villageID.replace('insidious_mapActionArea_village', '');

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
                Promise.allSettled(Array.from(this.#getVillagesID()).map((id: string) => {
                    return new Promise<void>(async (resolve, reject) => {
                        try {
                            const village = 'village' + id;
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
            });

            // CONFIGURAÇÕES
            const menuAreaOptionList = [
                ['customTagStatus', 'lastCustomTag'], // TAGS
                ['mapFiltersStatus', 'lastMapFilter']  // FILTROS
            ];

            // Ativa a última tag e o último filtro utilizados (caso estejam habilitados).
            Promise.all(menuAreaOptionList.map((item) => {
                return new Promise<void>(async (resolve) => {
                    const itemStatus: SSObject = await browser.storage.local.get(item[0]);
                    if (itemStatus[item[0]] === 'disabled') {
                        switch (item[0]) {
                            case 'customTagStatus': Manatsu.disableChildren(tagArea, 'button');
                                break;
                            case 'mapFiltersStatus': Manatsu.disableChildren(filterArea, 'button');
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
    
                        if (item[1] === 'lastCustomTag') {
                            const tagsCheckbox = document.querySelector('#insidious_customTags_checkbox');
                            if (!tagsCheckbox) throw new InsidiousError('A checkbox da área de tags não está presente.');
                            (tagsCheckbox as HTMLInputElement).checked = true;
                            addCustomTags(lastItem['lastCustomTag']);
    
                        } else if (item[1] === 'lastMapFilter') {
                            const filtersCheckbox = document.querySelector('#insidious_mapFilters_checkbox');
                            if (!filtersCheckbox) throw new InsidiousError('A checkbox da área de filtros não está presente.');
                            (filtersCheckbox as HTMLInputElement).checked = true;
                            addMapFilters(lastItem['lastMapFilter']);
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

    static #getVillagesID(): Set<string> {
        const villages: Set<string> = new Set();
        const mapImages = document.querySelectorAll('#map_container div img[id^="map_village_"]:not([id*="undefined"])');
        mapImages.forEach((img) => {
            const imgID = img.getAttribute('id');
            if (imgID === null || imgID === '') return;
            villages.add(imgID.replace('map_village_', ''));
        });

        return villages;
    };

    static #hideUndefinedVillages() {
        const mapContainer = document.querySelector('#map_container');
        if (!mapContainer) throw new InsidiousError('DOM: #map_container');

        const undefinedVillages = mapContainer.querySelectorAll('#map_village_undefined');
        undefinedVillages.forEach((unVillage) => {
            if (!unVillage.hasAttribute('insidious-map-filter')) {
                unVillage.setAttribute('insidious-map-filter', 'hidden');
            };
        });
    };

    static get open() {return this.#open};
};