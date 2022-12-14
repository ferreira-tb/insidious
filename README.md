# Insidious
Insidious é uma extensão para o jogo de navegador Tribal Wars.

## Antes de usar
Insidious é destinado para uso apenas no Mozilla Firefox (versão 105 ou superior) e é desenvolvido com base no **Manifest V3**, que *ainda* não é a versão padrão para esse navegador.

Sendo assim, para usá-lo, é preciso ativar manualmente o suporte ao Manifest V3 nas configurações do navegador. Para fazer isso, acesse `about:config` e então altere o valor de `extensions.manifestV3.enabled` para `true`. Se quiser saber mais detalhes, acesse o [guia da Mozilla sobre o Manifest V3](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/).

Em seguida, faça download da [release](https://github.com/ferreira-tb/insidious/releases) mais recente do Insidious e então instale como extensão temporária acessando `about:debugging` em seu Firefox. No momento, não há release estável disponível. Antes de tentar usar a versão *alpha*, certifique-se de ler a [issue #5](https://github.com/ferreira-tb/insidious/issues/5).

Lembre-se: se tiver qualquer dúvida, é só criar uma nova [issue](https://github.com/ferreira-tb/insidious/issues) e perguntar!

## Funcionalidades
- Farm automático:
    - Não ataca às cegas: escolhe bem os alvos.
    - Derruba muralhas.

- Ataque e apoio:
    - Envia ataque ou apoio que chega no horário indicado (experimental).
    - Etiqueta automaticamente.
    
- Aldeia:
    - Exibe os recursos retornando dos saques.

- Mercado:
    - Cria ofertas para balancear os recursos da aldeia.

- Relatórios:
    - Exibe a lealdade atual da aldeia-alvo, com base no último valor conhecido.

- Perfil:
    - Distância e tempo de viagem até cada aldeia do jogador.
