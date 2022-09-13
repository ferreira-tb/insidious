'use strict';
class TWMap {
    static #open() {
        try {
            // Elementos originais.
            const mapLegend = document.querySelector('#map_legend');
            const mapBig = document.querySelector('#map_big');

            // Elementos da extensão.
            const menuArea = document.createElement('div');
            menuArea.setAttribute('id', 'insidious_mapMenuArea');
            mapBig?.insertBefore(menuArea, mapLegend);

            const buttonArea = document.createElement('div');
            buttonArea.setAttribute('id', 'insidious_mapButtonArea');
            menuArea.appendChild(buttonArea);

            const actionArea = document.createElement('div');
            actionArea.setAttribute('id', 'insidious_mapActionArea');
            menuArea.appendChild(actionArea);

            const getBBCoordsBtn = document.createElement('button');
            getBBCoordsBtn.innerText = 'Coordenadas BB';
            buttonArea.appendChild(getBBCoordsBtn);

            // Funções.
            const clearActionArea = () => {
                while (actionArea.firstChild) actionArea.removeChild(actionArea.firstChild);
            };

            // Ações.
            getBBCoordsBtn.addEventListener('click', () => {
                clearActionArea();
                
                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
                Promise.all(this.#getVillagesID().map((id) => {
                    return new Promise((resolve, reject) => {
                        const village = 'village' + id;
                        Insidious.storage.get(village)
                            .then((result) => {
                                if (result[village]?.player === 0) {
                                    const coords = document.createElement('span');
                                    coords.setAttribute('class', 'insidious_mapActionArea_coords');
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
                                    });
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