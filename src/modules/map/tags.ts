class MapTag extends TWMap {
    /** Chave para obter o status atual das tags de mapa (customTagStatus). */
    static readonly key = `customTagStatus_${Insidious.world}`;
    /** Chave para obter a última tag utilizada no mapa (lastCustomTag). */
    static readonly lastKey = `lastCustomTag_${Insidious.world}`;

    static async #create(tagType: TagType) {
        // Desconecta qualquer observer de tag que esteja ativo no mapa.
        this.eventTarget.dispatchEvent(new Event('stoptagobserver'));

        if ((await browser.storage.local.get(this.key))[this.key] === false) return;

        // Salva a última tag utilizada, para que seja ativada automaticamente na próxima vez.
        browser.storage.local.set({ [this.lastKey]: tagType })
            .catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });

        // Vasculha os elementos do mapa e retorna aqueles que são aldeias.
        const mapVillages: Set<string> = this.getVillagesID();
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
                if (id === Insidious.village) {
                    reject();
                    return;
                };

                try {
                    const village = `v${id}_${Insidious.world}`;
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
                        const coords: number[] = [this.currentX, this.currentY, targetX, targetY];
                        if (coords.some(coord => !Number.isInteger(coord))) {
                            throw new InsidiousError(`As coordenadas obtidas são inválidas (${Insidious.village} e/ou ${id}).`);
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
                        const unitName = tagType.replace('time_', '') as UnitList;
                        if (!Insidious.unitInfo || !Insidious.worldInfo) {
                            browser.storage.local.remove(Insidious.worldConfigKey);
                            throw new InsidiousError('Não foi possível obter as configurações do mundo.');
                        };

                        const unitSpeed = Insidious.unitInfo[unitName].speed;
                        const worldUnitSpeed = Insidious.worldInfo.unit_speed;

                        const millisecondsPerField = 60000 * (unitSpeed * worldUnitSpeed);
                        const fieldAmount = Utils.calcDistance(...getRelativeCoords());
                        const travelTime = millisecondsPerField * fieldAmount;
                        
                        villageCustomTag.textContent = this.#getFullHours(travelTime);
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
        const observeTag = new MutationObserver(() => this.#create(tagType));
        observeTag.observe(mapContainer, { subtree: true, childList: true });

        const customTagsCtrl = new AbortController();
        this.eventTarget.addEventListener('stoptagobserver', () => {
            observeTag.disconnect();
            customTagsCtrl.abort();
        }, { signal: customTagsCtrl.signal });
    };

    static #getFullHours(travelTime: number): string {
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

    static get create() { return this.#create };
};