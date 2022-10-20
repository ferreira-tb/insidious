# Insidious
Insidious é uma extensão para o jogo de navegador Tribal Wars.

## Antes de usar
Insidious é destinado para uso apenas no Mozilla Firefox (versão 105 ou superior) e é desenvolvido com base no **Manifest V3**, que *ainda* não é a versão padrão para esse navegador.

Sendo assim, para usá-lo, é preciso ativar manualmente o suporte ao Manifest V3 nas configurações do navegador. Para fazer isso, acesse `about:config` e então altere o valor de `extensions.manifestV3.enabled` para `true`. Se quiser saber mais detalhes, acesse o [guia da Mozilla sobre o Manifest V3](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/).

Em seguida, faça download da [release](https://github.com/ferreira-tb/insidious/releases) mais recente do Insidious e então instale como extensão temporária acessando `about:debugging` em seu Firefox. *Observação: no momento, ainda não há release estável disponível. A primeira versão beta será publicada em 01 de outubro de 2022.*

Ao contrário de algumas outras ferramentas que existem mundo afora, o Insidious terá código aberto e será distribuído gratuitamente. A única coisa que eu, como autor, peço em troca é o envio de **feedback** sobre a extensão. Se encontrar um bug ou tiver alguma sugestão a fazer ou simplesmente estar com dúvida sobre algo, crie uma [issue](https://github.com/ferreira-tb/insidious/issues) aqui no repositório.

## Funcionalidades
- Farm automático:
    - Não ataca às cegas: escolhe bem os alvos.
    - Derruba muralhas.

- Etiqueta ataques automaticamente.
- Relatórios:
    - Exibe a quantidade de lealdade atual da aldeia-alvo, com base no último valor conhecido.
    
## Próximos passos
- Ataque e defesa
    - [ ] Envio de fakes.
    - [ ] Envio de snipe e anti-snipe.
    - [ ] Planejador de ataques.
- Mercado
    - [ ] Balanceamento de recursos das aldeias.
    - [ ] Compra e venda de pontos premium no mercado, buscando maximizar o lucro com base na cotação.
- Outros
    - [ ] Renomeador de aldeias.
