class Keys {
    ////// INSIDIOUS
    /** CHAVE: intervalo (em horas) entre cada Insidius.fetch() (fetchInterval). */
    static readonly fetch = `fetchInterval`;
    /** CHAVE: data do último fetch das configurações do mundo atual (worldConfigFetch). */
    static readonly worldConfig = `worldConfigFetch_${Insidious.world}`;
    /** CHAVE: data do último fetch das informações sobre o estado atual do mundo (worldDataFetch). */
    static readonly worldData = `worldDataFetch_${Insidious.world}`;
    /** CHAVE: configurações do mundo atual (config). */
    static readonly config = `config_${Insidious.world}`;
    /** CHAVE: detalhes sobre as unidades do jogo (unit). */
    static readonly unit = `unit_${Insidious.world}`;
    /** CHAVE: último mundo acessado pelo jogador (lastWorld). */
    static readonly lastWorld = `lastWorld`;
    /** CHAVE: mundos nos quais o jogador está ativo (activeWorlds). */
    static readonly activeWorlds = `activeWorlds`;

    ////// PLUNDER
    /** CHAVE: informações sobre o modelo de saque A (amodel). */
    static readonly plunderA = `amodel_${Insidious.world}`;
    /** CHAVE: informações sobre o modelo de saque B (bmodel). */
    static readonly plunderB = `bmodel_${Insidious.world}`;

    /** CHAVE: status atual do Plunder (isPlunderActive). */
    static readonly plunder = `isPlunderActive_${Insidious.world}`;
    /** CHAVE: opções do Plunder (plunderOptions). */
    static readonly plunderOptions = `plunderOptions_${Insidious.world}`;
    /** CHAVE: parâmetros das opções do Plunder (plunderOptionsParameters). */
    static readonly plunderParameters = `plunderOptionsParameters_${Insidious.world}`;
    /** CHAVE: recursos saqueados e ataques enviados pelo processo atual do Plunder (totalPlundered). */
    static readonly totalPlundered = `totalPlundered_${Insidious.world}`;
    /** CHAVE: soma dos recursos saqueados e ataques enviados desde a primeira execução do Plunder (globalPlundered). */
    static readonly globalPlundered = `globalPlundered_${Insidious.world}`;
    /** CHAVE: lista de aldeias já atacadas pelo Plunder (alreadyPlunderedVillages). */
    static readonly alreadyPlundered = `alreadyPlunderedVillages_${Insidious.world}`;
    /** CHAVE: quantidade total de muralhas destruídas pelo Plunder. */
    static readonly plunderWalls = `plunderDestroyedWalls_${Insidious.world}`;

    /** CHAVE: ID do grupo Insidious usado pelo Plunder (farmGroupID). */
    static readonly farmGroup = `farmGroupID_${Insidious.world}`;
    /** CHAVE: retorna true se a criação do grupo Insidious usado pelo Plunder estiver pendente (farmGroupCreation). */
    static readonly farmGroupCreation = `farmGroupCreation_${Insidious.world}`;

    ////// SHIELD
    /** CHAVE: status atual do Shield (isShieldActive). */
    static readonly shield = `isShieldActive_${Insidious.world}`;
    /** CHAVE: histórico de navegação envolvendo o Shield (shieldNavigationHistory). */
    static readonly shieldNavigation = `shieldNavigationHistory_${Insidious.world}`;
    /** CHAVE: Set com os IDs dos ataques a caminho (incomingAttacksIDList). */
    static readonly shieldIncomings = `incomingAttacksIDList_${Insidious.world}`;
    /** CHAVE: detalhes sobre qualquer operação que o Shield esteja executando (shieldStatus). */
    static readonly shieldStatus = `shieldStatus_${Insidious.world}`;

    ////// MAPA
    /** CHAVE: status atual das tags de mapa (customTagStatus). */
    static readonly mapTag = `customTagStatus_${Insidious.world}`;
    /** CHAVE: última tag utilizada no mapa (lastCustomTag). */
    static readonly lastMapTag = `lastCustomTag_${Insidious.world}`;

    /** CHAVE: status atual dos filtros de mapa (mapFiltersStatus). */
    static readonly mapFilter = `mapFiltersStatus_${Insidious.world}`;
    /** CHAVE: último filtro utilizado no mapa (lastMapFilter). */
    static readonly lastMapFilter = `lastMapFilter_${Insidious.world}`;
};