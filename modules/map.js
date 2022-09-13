'use strict';
class TWMap {
    static #open() {
        try {
            // Elementos originais.
            const mapLegend = document.querySelector('#map_legend');
            const mapBig = document.querySelector('#map_big');

            // Elementos da extensão.
            const menuArea = document.createElement('div');
            menuArea.setAttribute('id', 'insidious_menuArea');
            mapBig?.insertBefore(menuArea, mapLegend);

            const buttonArea = document.createElement('div');
            menuArea.appendChild(buttonArea);

            const actionArea = document.createElement('div');
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
                const coordSpanCtrl = new AbortController();
                
                // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
                Promise.all(this.#getVillagesID().map((id) => {
                    return new Promise((resolve, reject) => {
                        const village = 'village' + id;
                        Insidious.storage.get(village)
                            .then((result) => {
                                if (result[village]?.player === 0) {
                                    const coords = document.createElement('span');
                                    coords.setAttribute('class', 'insidious_actionArea_coords');
                                    coords.innerText = `${result[village].x}\|${result[village].y}`;
                                    actionArea.appendChild(coords);
                                };

                                resolve();
                            })
                            .catch((err) => reject(err));
                    });
                }));
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