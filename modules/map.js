'use strict';
class TWMap {
    static #open() {
        try {
            // Elementos originais.
            const mapLegend = document.querySelector('#map_legend');
            if (!mapLegend) throw new ElementError({ id: 'map_legend' });

            const mapBig = document.querySelector('#map_big');
            if (!mapBig) throw new ElementError({ id: 'map_big' });

            const mapContainer = document.querySelector('#map_container');
            if (!mapContainer) throw new ElementError({ id: 'map_container' });

            // Elementos da extensão.
            const menuArea = document.createElement('div');
            menuArea.setAttribute('id', 'insidious_mapMenuArea');
            mapBig.insertBefore(menuArea, mapLegend);

            const buttonArea = document.createElement('div');
            buttonArea.setAttribute('id', 'insidious_mapButtonArea');
            menuArea.appendChild(buttonArea);

            const actionArea = document.createElement('div');
            actionArea.setAttribute('id', 'insidious_mapActionArea');
            menuArea.appendChild(actionArea);

            ////// BOTÕES
            const getBBCoordsBtn = document.createElement('button');
            getBBCoordsBtn.innerText = 'Coordenadas BB';
            buttonArea.appendChild(getBBCoordsBtn);

            const showPointsBtn = document.createElement('button');
            showPointsBtn.innerText = 'Pontos';
            buttonArea.appendChild(showPointsBtn);

            const showBBPointsBtn = document.createElement('button');
            showBBPointsBtn.innerText = 'Pontos BB';
            buttonArea.appendChild(showBBPointsBtn);

            const showTimeBtn = document.createElement('button');
            showTimeBtn.innerText = 'Tempo';
            buttonArea.appendChild(showTimeBtn);

            const showDistanceBtn = document.createElement('button');
            showDistanceBtn.innerText = 'Distância';
            buttonArea.appendChild(showDistanceBtn);

            ////// FUNÇÕES
            const mapTarget = new EventTarget();

            const clearActionArea = () => {
                mapTarget.dispatchEvent(new Event('clearactionarea'));
                while (actionArea.firstChild) actionArea.removeChild(actionArea.firstChild);
            };

            const addCustomTags = (tagType) => {
                mapTarget.dispatchEvent(new Event('stopmapobserver'));

                // Analisa as tags já existentes e remove aquelas que são diferentes do tipo escolhido ao chamar essa função.
                // Além disso, recolhe os IDs das tags que não foram removidas.
                const oldTagsID = [];
                const oldCustomTags = document.querySelectorAll('.insidious_map_villageCustomTag');
                if (oldCustomTags.length > 0) {
                    oldCustomTags.forEach((customTag) => {
                        if (customTag.getAttribute('insidious') !== tagType) {
                            customTag.parentNode.removeChild(customTag);

                        } else {
                            oldTagsID.push(customTag.getAttribute('village'));
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
                    return new Promise((resolve, reject) => {
                        const village = 'village' + id;
                        const currentVillageID = Utils.currentVillage();
                        Insidious.storage.get([village, 'village' + currentVillageID])
                            .then((result) => {                          
                                if (id !== currentVillageID) {
                                    const villageCustomTag = document.createElement('div');
                                    villageCustomTag.setAttribute('class', 'insidious_map_villageCustomTag');
                                    villageCustomTag.setAttribute('insidious', tagType);
                                    villageCustomTag.setAttribute('village', id);

                                    const villageElement = document.querySelector('#map_village_' + id);
                                    if (!villageElement) throw new ElementError({ id: '#map_village_' + id });

                                    let elementStyle = villageElement.getAttribute('style').split(';');
                                    elementStyle = elementStyle.filter((property) => {
                                        if (property.startsWith(' left:') || property.startsWith(' top:')) return true;
                                        return false;
                                    });

                                    const elementPosition = (elementStyle[0].trimStart()).concat(';', elementStyle[1], ';');
                                    villageCustomTag.setAttribute('style', elementPosition);
                                    villageElement.parentNode.insertBefore(villageCustomTag, villageElement);

                                    if (tagType === 'distance') {
                                        const coords = [
                                            result['village' + currentVillageID]?.x,
                                            result['village' + currentVillageID]?.y,
                                            result[village]?.x,
                                            result[village]?.y
                                        ];

                                        if (coords.includes(undefined)) throw new InsidiousError('Não foi possível obter as coordenadas.');
                                        villageCustomTag.innerText = Utils.calcDistance(...coords);
                                    };
                                };

                                resolve();
                            })
                            .catch((err) => reject(err));
                    });

                })).then(() => {
                    // Verifica se houve mudança no DOM decorrente da movimentação do mapa.
                    // Em caso positivo, dispara a função novamente.
                    const observeMap = new MutationObserver(() => addCustomTags(tagType));
                    observeMap.observe(mapContainer, { subtree: true, childList: true });

                    const customTagsCtrl = new AbortController();
                    mapTarget.addEventListener('stopmapobserver', () => {             
                        observeMap.disconnect();
                        customTagsCtrl.abort();
                    }, { signal: customTagsCtrl.signal });
                });
            };

            ////// EVENTOS
            showTimeBtn.addEventListener('click', () => addCustomTags('time'));
            showDistanceBtn.addEventListener('click', () => addCustomTags('distance'));

            // Coleta as coordenadas das aldeias bárbaras no mapa.
            getBBCoordsBtn.addEventListener('click', () => {
                clearActionArea();

                const getBBCoordsCtrl = new AbortController();
                mapTarget.addEventListener('clearactionarea', () => {
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