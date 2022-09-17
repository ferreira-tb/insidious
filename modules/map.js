'use strict';
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
            const buttonArea = new Manatsu({ id: 'insidious_mapButtonArea' }).create();
            menuArea.appendChild(buttonArea);

            // Área usada por alguns eventos para exibir resultados.
            const actionArea = new Manatsu({ id: 'insidious_mapActionArea' }).create();
            menuArea.appendChild(actionArea);

            ////// BOTÕES
            const getBBCoordsBtn = new Manatsu('button', { text: 'Coordenadas BB', class: 'insidious_mapButtonArea_Btn' }).create();
            buttonArea.appendChild(getBBCoordsBtn);

            const showPointsBtn = new Manatsu('button', { text: 'Pontos', class: 'insidious_mapButtonArea_Btn' }).create();
            buttonArea.appendChild(showPointsBtn);

            const showBBPointsBtn = new Manatsu('button', { text: 'Pontos BB', class: 'insidious_mapButtonArea_Btn' }).create();
            buttonArea.appendChild(showBBPointsBtn);

            const showTimeBtn = new Manatsu('button', { text: 'Tempo', class: 'insidious_mapButtonArea_Btn' }).create();
            buttonArea.appendChild(showTimeBtn);

            const showDistanceBtn = new Manatsu('button', { text: 'Distância', class: 'insidious_mapButtonArea_Btn' }).create();
            buttonArea.appendChild(showDistanceBtn);

            const clearTagsBtn = new Manatsu('button', { text: 'Limpar', class: 'insidious_mapButtonArea_Btn' }).create();
            buttonArea.appendChild(clearTagsBtn);

            ////// FUNÇÕES
            const mapEventTarget = new EventTarget();

            const clearActionArea = () => {
                mapEventTarget.dispatchEvent(new Event('clearactionarea'));
                Manatsu.removeChildren(actionArea);
            };

            const addCustomTags = (tagType) => {
                // Desconecta qualquer observer que esteja ativo no mapa.
                mapEventTarget.dispatchEvent(new Event('stopmapobserver'));

                // Salva no registro a última tag utilizada, para que seja ativada automaticamente na próxima vez.
                Insidious.storage.set({ lastCustomTag: tagType })
                    .catch((err) => console.error(err));

                // Analisa as tags já existentes e remove aquelas que são diferentes do tipo escolhido ao chamar essa função.
                // Além disso, recolhe os IDs das tags que não foram removidas.
                const oldTagsID = [];
                const oldCustomTags = document.querySelectorAll('.insidious_map_villageCustomTag');
                if (oldCustomTags.length > 0) {
                    oldCustomTags.forEach((customTag) => {
                        if (customTag.dataset.insidiousTagType !== tagType) {
                            customTag.parentNode.removeChild(customTag);

                        } else {
                            oldTagsID.push(customTag.dataset.insidiousVillage);
                        };
                    });
                };

                if (tagType === 'clear') return;

                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
                // Em seguida, remove aquelas que já possuem tags.
                let mapVillages = this.#getVillagesID();
                mapVillages = mapVillages.filter((villageID) => {
                    if (oldTagsID.includes(villageID)) return false;
                    return true;
                });

                // Adiciona as novas tags.
                Promise.allSettled(mapVillages.map((id) => {
                    return new Promise((resolve, reject) => {
                        const village = 'village' + id;
                        const currentVillageID = Utils.currentVillage();
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

                                    let elementStyle = villageElement.getAttribute('style').split(';');
                                    elementStyle = elementStyle.filter((property) => {
                                        if (property.includes('left:') || property.includes('top:')) return true;
                                        return false;
                                    });

                                    const adjustTop = () => {
                                        let topValue = elementStyle[0].includes('top') ? elementStyle[0] : elementStyle[1];
                                        topValue = topValue.replace('top:', '').replace('px', '').trim();
                                        return `top: ${String(Number(topValue) + 20)}px;`;
                                    };

                                    const adjustLeft = () => {
                                        let leftValue = elementStyle[0].includes('left') ? elementStyle[0] : elementStyle[1];
                                        return ` ${leftValue};`;
                                    };

                                    const elementPosition = adjustTop().concat(adjustLeft());
                                    villageCustomTag.setAttribute('style', elementPosition);
                                    villageElement.parentNode.insertBefore(villageCustomTag, villageElement);

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
                                        villageCustomTag.innerText = distance.toFixed(1);

                                    } else if (tagType === 'points') {
                                        if (!result[village]?.points) throw new InsidiousError('Aldeia não encontrada no registro.');
                                        if (result[village]?.player !== 0) villageCustomTag.innerText = result[village].points;

                                    } else if (tagType === 'bbpoints') {
                                        if (!result[village]?.points) throw new InsidiousError('Aldeia não encontrada no registro.');
                                        if (result[village]?.player === 0) villageCustomTag.innerText = result[village].points;

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

                                        villageCustomTag.innerText = getFullHours();
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

                }).catch((err) => console.error(err));
            };

            ////// EVENTOS
            showDistanceBtn.addEventListener('click', () => addCustomTags('distance'));
            showPointsBtn.addEventListener('click', () => addCustomTags('points'));
            showBBPointsBtn.addEventListener('click', () => addCustomTags('bbpoints'));
            clearTagsBtn.addEventListener('click', () => addCustomTags('clear'));

            showTimeBtn.addEventListener('click', async () => {
                try {
                    const worldInfo = await Insidious.storage.get('config');
                    if (!worldInfo.config?.game) throw new InsidiousError('Não foi possível obter as configurações do mundo.');

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
    
                    isThereArchers().forEach((unit) => {
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
                    console.error(err)
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
                    if (e.target.className === 'insidious_mapActionArea_coords') {
                        try {
                            const villageID = e.target.id.replace('insidious_mapActionArea_village', '');
                            const villageElement = document.querySelector('#map_village_' + villageID);
                            if (!villageElement) return;

                            if (!villageElement.hasAttribute('class')) {
                                villageElement.setAttribute('class', 'insidious_map_glow');     
                            } else {
                                throw new ElementError({ class: villageElement.getAttribute('class') });
                            };

                        } catch (err) {
                            if (err instanceof ElementError) console.error(err);
                        }; 
                    };
                }, { signal: getBBCoordsCtrl.signal });

                actionArea.addEventListener('mouseout', (e) => {
                    e.stopPropagation();
                    if (e.target.className === 'insidious_mapActionArea_coords') {
                        try {
                            const villageID = e.target.id.replace('insidious_mapActionArea_village', '');
                            const villageElement = document.querySelector('#map_village_' + villageID);
                            if (!villageElement) return;

                            if (villageElement.className === 'insidious_map_glow') {
                                villageElement.removeAttribute('class');
                            } else {
                                throw new ElementError({ class: villageElement.getAttribute('class') });
                            };

                        } catch (err) {
                            if (err instanceof ElementError) console.error(err);
                        };
                    };
                }, { signal: getBBCoordsCtrl.signal });
                
                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
                // Em seguida, filtra o resultado para que hajam apenas bárbaras.
                Promise.all(this.#getVillagesID().map((id) => {
                    return new Promise((resolve, reject) => {
                        const village = 'village' + id;
                        Insidious.storage.get(village)
                            .then((result) => {
                                if (result[village]?.player === 0) {
                                    const coords = document.createElement('span');
                                    coords.setAttribute('class', 'insidious_mapActionArea_coords');
                                    coords.setAttribute('id', 'insidious_mapActionArea_' + 'village' + id);
                                    coords.innerText = `${result[village].x}\|${result[village].y}`;
                                    actionArea.appendChild(coords);

                                    coords.addEventListener('click', () => {
                                        const range = document.createRange();
                                        range.selectNodeContents(coords);

                                        const selection = window.getSelection();
                                        selection.removeAllRanges();
                                        selection.addRange(range);

                                        navigator.clipboard.writeText(coords.innerText)
                                            .catch((err) => console.error(err));

                                    }, { signal: getBBCoordsCtrl.signal });
                                };

                                resolve();
                            })
                            .catch((err) => reject(err));
                    });

                })).catch((err) => console.error(err));
            });

            // CONFIGURAÇÕES
            // Ativa a última tag utilizada.
            Insidious.storage.get('lastCustomTag')
                .then(async (result) => {
                    if (result.lastCustomTag && result.lastCustomTag !== 'clear') {
                        // O jogo comumente demora a carregar o #map_container, o que impede o carregamento das tags.
                        if (!document.querySelector('#map_container')) {
                            await delayCustomTags(result.lastCustomTag);

                        } else {
                            addCustomTags(result.lastCustomTag);
                        };
                    };

                }).catch((err) => console.error(err));

            function delayCustomTags(lastCustomTag) {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        // Caso #map_container ainda não exista, rejeita a promise.
                        // Isso porquê o problema pode já não ser relacionado ao carregamento da página.
                        if (!document.querySelector('#map_container')) {
                            reject(new ElementError({ id: 'map_container' }));
                            
                        } else {
                            addCustomTags(lastCustomTag);
                            resolve();
                        };
                    }, 500);
                });
            };
            
        } catch (err) {
            console.error(err);
        };
    };

    static #getVillagesID() {
        const villages = [];
        const mapImages = document.querySelectorAll('#map_container div img');
        mapImages.forEach((img) => {
            if (img.id.startsWith('map_village_') && img.id !== 'map_village_undefined') {
                villages.push(img.id.replace('map_village_', ''));
            };
        });

        return villages;
    };

    static get open() {return this.#open};
};