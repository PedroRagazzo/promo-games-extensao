# Promo Games - Comparador de Preços

Extensão para Chrome/Edge (Manifest V3) que pesquisa um jogo e mostra o menor preço
disponível entre lojas oficiais (Steam, Epic Games Store, GOG...) e revendedores
terceiros (Nuuvem, GreenManGaming, Fanatical...), com desconto, preço original e
link direto para a oferta.

Os dados de preço vêm da API pública do [IsThereAnyDeal](https://isthereanydeal.com)
(ITAD), que agrega dezenas de lojas em várias regiões.

Visual: tema "fliperama retrô" — fundo roxo quase-preto, painéis com cantos
chanfrados, logotipo em fonte pixelada (Press Start 2P) e acentos neon: ciano
para preço/ação, magenta para promoção/desconto, âmbar para lojas oficiais.
Fontes hospedadas localmente em [fonts/](fonts/), tokens de cor e tipografia
compartilhados em [shared/theme.css](shared/theme.css).

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** ("Load unpacked") e selecione esta pasta
   (`Promo Extensão Nav`).
4. O ícone verde com "%" vai aparecer na barra de extensões.

## Configuração (obrigatória antes do primeiro uso)

A extensão precisa de uma chave de API gratuita do IsThereAnyDeal:

1. Crie uma conta em [isthereanydeal.com](https://isthereanydeal.com) (login com
   e-mail, Google ou Steam).
2. Gere uma chave em [isthereanydeal.com/apps/my](https://isthereanydeal.com/apps/my/)
   (crie um "app" qualquer, o nome não importa).
3. Clique no ícone da extensão → engrenagem (⚙) → cole a chave em **Chave de API**.
4. Escolha o **país de referência de preços** (padrão: Brasil/BRL) e clique em
   **Salvar**. Use o botão **Testar chave** para confirmar que está tudo certo.

## Como usar

1. Clique no ícone da extensão.
2. Ao abrir, o popup já mostra automaticamente os **🔥 Destaques de hoje** —
   os jogos com maior desconto no momento (só jogos, sem DLCs, com pelo menos
   30% off e boa avaliação na Steam), um por card, com loja, preço, desconto e
   link direto.
3. Para pesquisar um jogo específico, digite o nome e clique em **Buscar**;
   use **Ver destaques de hoje** para voltar aos destaques.
4. Escolha o resultado correto na lista (ou clique no título de um destaque)
   para ver a comparação completa entre todas as lojas, com:
   - Preço atual e preço original (riscado) quando há desconto;
   - Percentual de desconto;
   - Selo **Oficial** (loja da própria publisher/plataforma) ou **Revendedor**
     (terceiros como Nuuvem, GreenManGaming etc.);
   - Selo **Menor preço** na melhor oferta;
   - Link **Ver oferta** que abre a loja em uma nova aba.

### Notificação diária (opcional)

Nas configurações (⚙), em **Destaques diários**, você pode ativar uma
notificação do navegador uma vez por dia com a melhor promoção encontrada
(ativada por padrão, às 12h). Ajuste o horário no seletor **Horário da
notificação**. Clicar na notificação abre a oferta direto no navegador.

Os destaques de hoje ficam em cache local por dia (por país configurado),
então abrir o popup várias vezes no mesmo dia não gera chamadas extras à API.
O cache dos dias anteriores é apagado automaticamente.

### Alertas de preço

Na comparação de preços de qualquer jogo, o painel **🔔 Alerta de preço** deixa
você definir o valor que quer pagar (sugerimos o menor preço já registrado).
Quando alguma loja chegar nesse valor ou abaixo, o navegador mostra uma
notificação e clicar nela abre a oferta. A extensão confere todos os alertas a
cada 3 horas (uma única chamada à API) e avisa de novo só se o preço cair ainda
mais ou se voltar a subir acima da meta e depois cair de novo. O sino no
cabeçalho lista seus alertas, mostra o menor preço visto na última checagem
("agora") ao lado da meta e permite removê-los. A meta fica na moeda do país escolhido
nas configurações; ofertas em outra moeda são ignoradas.

## Sobre cupons de desconto

Não existe uma API pública confiável que liste cupons de desconto válidos para
lojas de jogos. Por isso, esta primeira versão foca 100% em comparar preços e
descontos já aplicados nas lojas. A única exceção é quando a própria ITAD já
identifica um voucher/cupom embutido no preço listado (campo `voucher` da API);
nesse caso a extensão mostra uma nota "Cupom aplicado automaticamente no preço:
CÓDIGO" abaixo da oferta.

Se no futuro você quiser cupons de fato (ex: uma lista curada de códigos por
loja), isso pode ser adicionado depois como um arquivo de dados separado,
mantido manualmente.

## Estrutura do projeto

```
manifest.json           Configuração da extensão (Manifest V3)
popup/                  Interface principal (destaques do dia, busca, comparação de preços)
options/                Página de configurações (chave de API, país, notificação diária)
background/background.js  Agenda e dispara a notificação diária (chrome.alarms)
lib/itad-api.js         Cliente da API do IsThereAnyDeal
lib/settings.js         Leitura/gravação de configurações (chrome.storage.sync)
lib/daily-deals.js      Cache diário dos destaques (chrome.storage.local)
lib/watchlist.js        Alertas de preço: lista acompanhada e regra de disparo
tests/                  Testes automatizados (node --test)
icons/                  Ícones da extensão (pixel art)
fonts/                  Fontes autohospedadas (Press Start 2P, Space Grotesk)
shared/theme.css        Tokens de cor/tipografia e componentes base do tema
```

## Testes

Testes automatizados da lógica (cliente da API e regra dos alertas), sem
dependências além do Node 18+:

```bash
npm test
```

## Limitações conhecidas

- A lista de lojas disponíveis depende do país escolhido nas configurações
  (algumas lojas não vendem/reportam preço para certas regiões).
- A chave de API tem limite de 1000 requisições a cada 5 minutos, o que é mais
  do que suficiente para uso pessoal.
- GreenManGaming e Nuuvem cobrem boa parte do catálogo, mas nem todo jogo está
  presente em todas as lojas.
