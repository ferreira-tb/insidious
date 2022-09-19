class TWMap {
    static #open() {
        try {
            // Elementos originais.
            const mapLegend = document.querySelector('#map_legend');
            if (!mapLegend) throw new ElementError({ id: 'map_legend' });

            const mapBig = document.querySelector('#map_big');
            if (!mapBig) throw new ElementError({ id: 'map_big' });

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
            
            const getBBCoordsBtn = new Manatsu('button',{
                text: 'Bárbaras',
                class: 'insidious_mapButtonArea_Btn'
            }, coordsArea).create();

            ////// FUNÇÕES
            const mapEventTarget = new EventTarget();

            const clearActionArea = () => {
                mapEventTarget.dispatchEvent(new Event('clearactionarea'));
                Manatsu.removeChildren(actionArea);
            };

            const addCustomTags = async (tagType: string) => {
                // Desconecta qualquer observer que esteja ativo no mapa.
                mapEventTarget.dispatchEvent(new Event('stopmapobserver'));

                const tagStatus = await Insidious.storage.get('customTagStatus');
                if (tagStatus?.customTagStatus === 'disabled') return;

                // Salva no registro a última tag utilizada, para que seja ativada automaticamente na próxima vez.
                Insidious.storage.set({ lastCustomTag: tagType })
                    .catch((err) => {
                        if (err instanceof Error) console.error(err);
                    });

                // Analisa as tags já existentes e remove aquelas que são diferentes do tipo escolhido ao chamar essa função.
                // Além disso, recolhe os IDs das tags que não foram removidas.
                const oldTagsID: (string | null)[] = [];
                const oldCustomTags = document.querySelectorAll('.insidious_map_villageCustomTag');
                if (oldCustomTags.length > 0) {
                    oldCustomTags.forEach((customTag) => {
                        if (customTag.getAttribute('data-insidious-tag-type') !== tagType) {
                            customTag.parentNode?.removeChild(customTag);

                        } else {
                            oldTagsID.push(customTag.getAttribute('data-insidious-village'));
                        };
                    });
                };

                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
                // Em seguida, remove aquelas que já possuem tags.
                let mapVillages = this.#getVillagesID();
                mapVillages = mapVillages.filter((villageID) => {
                    if (oldTagsID.includes(villageID)) return false;
                    return true;
                });

                // Adiciona as novas tags.
                Promise.allSettled(mapVillages.map((id) => {
                    return new Promise<void>((resolve, reject) => {
                        const village = 'village' + id;
                        const currentVillageID: string | undefined = Utils.currentVillage();
                        if (!currentVillageID) throw new InsidiousError('Não foi possível obter as coordenadas da aldeia atual.');

                        Insidious.storage.get([village, 'village' + currentVillageID])
                            .then(async (result) => {
                                if (id !== currentVillageID) {
                                    const villageCustomTag = new Manatsu({
                                        class: 'insidious_map_villageCustomTag',
                                        ['data-insidious-tag-type']: tagType,
                                        ['data-insidious-village']: id
                                    }).create();

                                    const villageElement = document.querySelector('#map_village_' + id);
                                    if (!villageElement) throw new ElementError({ id: '#map_village_' + id });

                                    const elementStyle: string | null = villageElement.getAttribute('style');
                                    if (!elementStyle) throw new InsidiousError('Não foi possível encontrar a tag de estilo em \"villageElement\".');

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
    
                                        if (!villageElement.parentNode) throw new InsidiousError('Não foi possível encontrar o elemento pai de \"villageElement\".');
                                        villageElement.parentNode.insertBefore(villageCustomTag, villageElement);

                                    } else {
                                        throw new InsidiousError('Não existem \"left\" e \"top\" entre os elementos de \"villageElement\"');
                                    };

                                    const getRelativeCoords = () => {
                                        const coords = [
                                            result['village' + currentVillageID]?.x,
                                            result['village' + currentVillageID]?.y,
                                            result[village]?.x,
                                            result[village]?.y
                                        ];

                                        if (coords.includes(undefined)) throw new InsidiousError('Não foi possível obter as coordenadas.');
                                        return coords;
                                    };

                                    if (tagType === 'distance') {
                                        const distance = Utils.calcDistance(...getRelativeCoords());
                                        villageCustomTag.textContent = distance.toFixed(1);

                                    } else if (tagType === 'points') {
                                        if (!result[village]?.points) throw new InsidiousError('Aldeia não encontrada no registro.');
                                        if (result[village]?.player !== 0) villageCustomTag.textContent = result[village].points;

                                    } else if (tagType === 'bbpoints') {
                                        if (!result[village]?.points) throw new InsidiousError('Aldeia não encontrada no registro.');
                                        if (result[village]?.player === 0) villageCustomTag.textContent = result[village].points;

                                    } else if (tagType.startsWith('time_')) {
                                        const unitName = tagType.replace('time_', '');
                                        const unitInfo = await Insidious.storage.get('unit');
                                        const worldInfo = await Insidious.storage.get('config');
                                        if (!unitInfo.unit || !worldInfo.config) throw new InsidiousError('Não foi possível obter as configurações do mundo.');

                                        const millisecondsPerField = 60000 * (unitInfo.unit[unitName].speed * worldInfo.config.unit_speed);
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
                                };

                                resolve();

                            }).catch((err) => reject(err));
                    });

                })).then(() => {
                    const mapContainer = document.querySelector('#map_container');
                    if (!mapContainer) throw new ElementError({ id: 'map_container' });

                    // Verifica se houve mudança no DOM decorrente da movimentação do mapa.
                    // Em caso positivo, dispara a função novamente.
                    const observeMap = new MutationObserver(() => addCustomTags(tagType));
                    observeMap.observe(mapContainer, { subtree: true, childList: true });

                    const customTagsCtrl = new AbortController();
                    mapEventTarget.addEventListener('stopmapobserver', () => {
                        observeMap.disconnect();
                        customTagsCtrl.abort();
                    }, { signal: customTagsCtrl.signal });

                }).catch((err) => {
                    if (err instanceof Error) console.error(err);
                });
            };

            ////// EVENTOS
            showDistanceBtn.addEventListener('click', () => addCustomTags('distance'));
            showPointsBtn.addEventListener('click', () => addCustomTags('points'));
            showBBPointsBtn.addEventListener('click', () => addCustomTags('bbpoints'));

            toggleTags.addEventListener('change', async () => {
                if (toggleTags.hasAttribute('checked')) {
                    await Insidious.storage.set({ customTagStatus: 'enabled' });

                    const lastTag: { lastCustomTag: string } = await Insidious.storage.get('lastCustomTag');
                    if (lastTag?.lastCustomTag) addCustomTags(lastTag.lastCustomTag);

                } else {
                    await Insidious.storage.set({ customTagStatus: 'disabled' });

                    const oldCustomTags = document.querySelectorAll('.insidious_map_villageCustomTag');
                    oldCustomTags.forEach((customTag) => customTag.parentNode?.removeChild(customTag));
                };
            });

            showTimeBtn.addEventListener('click', async () => {
                try {
                    const worldInfo = await Insidious.storage.get('config');
                    if (!worldInfo.config?.game) {
                        Insidious.storage.remove('worldConfigFetch')
                            .catch((err) => {
                                if (err instanceof Error) console.error(err);
                            });
                            
                        throw new InsidiousError('Não foi possível obter as configurações do mundo.');
                    };

                    clearActionArea();
                    const imgIconCtrl = new AbortController();
                    mapEventTarget.addEventListener('clearactionarea', () => {
                        imgIconCtrl.abort();
                    }, { signal: imgIconCtrl.signal });

                    const isThereArchers = () => {
                        switch (worldInfo.config.game.archer) {
                            case 0: return TWAssets.list.all_units;
                            case 1: return TWAssets.list.all_units_archer;
                            default: return TWAssets.list.all_units;
                        };
                    };
    
                    isThereArchers().forEach((unit: IconImgName) => {
                        const imgIcon = Utils.createIconImg(unit, '18');
                        imgIcon.setAttribute('style', 'cursor: pointer; margin-right: 5px;');
                        actionArea.appendChild(imgIcon);
    
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

            // Coleta as coordenadas das aldeias bárbaras no mapa.
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
                            const villageElement = document.querySelector('#map_village_' + villageID);
                            if (!villageElement) return;

                            if (!villageElement.hasAttribute('class')) {
                                villageElement.setAttribute('class', 'insidious_map_glow');     
                            } else {
                                throw new ElementError({ class: villageElement.getAttribute('class')! });
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
                                throw new ElementError({ class: villageClass });
                            };

                        } catch (err) {
                            if (err instanceof Error) console.error(err);
                        };
                    };
                }, { signal: getBBCoordsCtrl.signal });
                
                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
                // Em seguida, filtra o resultado para que hajam apenas bárbaras.
                Promise.allSettled(this.#getVillagesID().map((id: string) => {
                    return new Promise<void>(async (resolve, reject) => {
                        try {
                            const village = 'village' + id;
                            const result = await Insidious.storage.get(village);
                            if (!result[village]) reject(new InsidiousError(`Aldeia não encontrada no registro: ${village}`));

                            if (result[village].player === 0) {
                                const coords = document.createElement('span');
                                coords.setAttribute('class', 'insidious_mapActionArea_coords');
                                coords.setAttribute('id', 'insidious_mapActionArea_' + 'village' + id);
                                coords.textContent = `${result[village].x}\|${result[village].y}`;
                                actionArea.appendChild(coords);

                                coords.addEventListener('click', async () => {
                                    const range = document.createRange();
                                    range.selectNodeContents(coords);

                                    const selection = window.getSelection();
                                    if (selection) {
                                        selection.removeAllRanges();
                                        selection.addRange(range);
                                    };

                                    if (coords.textContent !== null) {
                                        try {
                                            await navigator.clipboard.writeText(coords.textContent);
                                        } catch (err) {
                                            if (err instanceof Error) console.error(err);
                                        };
                                    };
                                }, { signal: getBBCoordsCtrl.signal });
                            };

                            resolve();

                        } catch (err) {
                            if (err instanceof Error) console.error(err);
                            reject();
                        };                             
                    });
                }));
            });

            // CONFIGURAÇÕES
            // Ativa a última tag utilizada.
            Insidious.storage.get('lastCustomTag')
                .then(async (result: { lastCustomTag: string }) => {
                    const tagStatus: { customTagStatus: string } = await Insidious.storage.get('customTagStatus');
                    const tagsCheckbox = document.querySelector('#insidious_customTags_checkbox');
                    if (!tagsCheckbox) return;

                    if (tagStatus?.customTagStatus === 'disabled') {
                        tagsCheckbox.removeAttribute('checked');
                        return;
                    };
                    
                    tagsCheckbox.setAttribute('checked', '');

                    if (result.lastCustomTag) {
                        // O jogo comumente demora a carregar o #map_container, o que impede o carregamento das tags.
                        if (!document.querySelector('#map_container')) {
                            await delayCustomTags(result.lastCustomTag);

                        } else {
                            addCustomTags(result.lastCustomTag);
                        };
                    };

                }).catch((err) => {
                    if (err instanceof Error) console.error(err);
                });

            function delayCustomTags(lastCustomTag: string) {
                return new Promise<void>((resolve, reject) => {
                    setTimeout(() => {
                        // Caso #map_container ainda não exista, rejeita a promise.
                        // Isso porquê o problema pode já não ser relacionado ao carregamento da página.
                        if (!document.querySelector('#map_container')) {
                            reject(new ElementError({ id: '#map_container' }));
                            
                        } else {
                            addCustomTags(lastCustomTag);
                            resolve();
                        };
                    }, 500);
                });
            };
            
        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static #getVillagesID() {
        const villages: string[] = [];
        const mapImages = document.querySelectorAll('#map_container div img');
        mapImages.forEach((img) => {
            const imgID = img.getAttribute('id');
            if (!imgID) return;

            if (imgID.startsWith('map_village_') && imgID !== 'map_village_undefined') {
                villages.push(imgID.replace('map_village_', ''));
            };
        });

        return villages;
    };

    static get open() {return this.#open};
};