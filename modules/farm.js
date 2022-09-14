class TWFarm {
    static #open() {
        try {
            // Elementos originais.
            const plunderList = document.querySelector('#plunder_list tbody');
            if (!plunderList) throw new ElementError({ id: 'plunder_list tbody' });

            const plunderListFilters = document.querySelector('#plunder_list_filters');
            if (!plunderListFilters) throw new ElementError({ id: 'plunder_list_filters' });

            // Elementos da extensão.
            const menuArea = document.createElement('div');
            menuArea.setAttribute('id', 'insidious_farmMenuArea');
            plunderListFilters.parentNode.insertBefore(menuArea, plunderListFilters.nextSibling);

            const buttonArea = document.createElement('div');
            buttonArea.setAttribute('id', 'insidious_farmButtonArea');
            menuArea.appendChild(buttonArea);

            ////// BOTÕES
            const startFarmBtn = document.createElement('button');
            startFarmBtn.setAttribute('class', 'insidious_farmButtonArea_Btn');
            startFarmBtn.innerText = 'Saquear';
            buttonArea.appendChild(startFarmBtn);

            ////// EVENTOS
            // Pode não funcionar corretamente caso os atalhos de teclado nativos do jogo estiverem ativados.
            // Eles tem prioridade sobre o Insidious, o que impede o disparo do evento.
            window.addEventListener('keydown', (e) => {
                if (e.key === 'a' || e.key === 'b' || e.key === 'c') {
                    for (const child of plunderList.children) {
                        if (child.id?.startsWith('village_') && !child.getAttribute('style')?.includes('display: none;')) {
                            const village = child.id.replace('village_', '');
                            const farmBtns = document.querySelectorAll(`#${child.id} td a`);
                            const buttonToClick = () => {
                                const classToSearch = `farm_village_${village} farm_icon farm_icon_${e.key}`;
                                for (const btn of farmBtns) {
                                    if (btn.getAttribute('class') === classToSearch) return btn;
                                };

                                console.error(new InsidiousError(`Nenhum dos botões possui a classe "${classToSearch}"`));
                            };

                            buttonToClick()?.dispatchEvent(new Event('click'));
                            break;
                        };
                    };
                };
            });

        } catch (err) {
            console.error(err);
        };
    };

    static get open() {return this.#open};
};