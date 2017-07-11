require! {
  \async
  \lodash
  \request
  \express
  \ms
}

app = express!
app.use('/public', express.static('public'))

server_port = process.env.PORT || 3000
time_cache = process.env.TIME_CACHE || 10   # в минутах
limit-order-book = process.env.LIMIT_ORDER_BOOK || 100  # глубина стакана
ya-id = process.env.YA_ID

CACHE = date: 0, data: []
WALL_DATA   = {}
LIST_PAIR = []

objToString = (obj) ->
  str = ''
  Object.keys(obj).forEach (p) ->
    if obj.hasOwnProperty p
      str += "#{p} :: #{obj[p]}\n"
  str

text-error = (err) ->
  if lodash.isObject(err)
    if err.hasOwnProperty \error then err.error
    else if err.hasOwnProperty \message then err.message
    else objToString err
  else err

difference-between-numbers = (a, b) -> (b - a) / a * 100
percentage-between-numbers = (a, b) -> +(100 * (a - b) / b).toFixed 1

order-book = (list_pair, cbk) ->
  with []
    async.each list_pair, (pair) ->
      ..push (cbk) ->
        order-book-pair pair, cbk
    async.parallel .., cbk

order-book-pair = (pair, cbk) ->
  avg_percent = 300
  err, body <- reg "getorderbook?market=#{pair}&type=both&depth=#{limit-order-book}"
  return cbk err if err?
  try obj = JSON.parse(body)
  catch e
    return cbk(e)


  if !obj.result.buy? || !obj.result.sell?
    WALL_DATA[pair] := bid: 0, ask: 0
    return cbk null

  if !obj.result.buy.length || !obj.result.sell.length
    WALL_DATA[pair] := bid: 0, ask: 0
    return cbk null

  obj-buy = obj.result.buy.splice(0, limit-order-book)
  obj-sell = obj.result.sell.splice(0, limit-order-book)

  wall-data = {}
  bid_sum = lodash.sumBy(obj-buy, (v) -> v.Quantity)
  bid_avg = bid_sum / limit-order-book
  bid_index = lodash.findIndex(obj-buy, (v) ->
    percentage-between-numbers(v.Quantity, bid_avg) > avg_percent
  )
  ask_sum = lodash.sumBy(obj-sell, (v) -> v.Quantity)
  ask_avg = ask_sum / limit-order-book
  ask_index = lodash.findIndex(obj-sell, (v) ->
    percentage-between-numbers(v.Quantity, ask_avg) > avg_percent
  )
  WALL_DATA[pair] := do
    bid: if bid_index >= 0 then obj-buy[bid_index].Rate else 'Не найдено'
    ask: if ask_index >= 0 then obj-sell[ask_index].Rate else 'Не найдено'
  cbk null

currency-pair-list = (cbk) ->
  list-pair = []
  err, body <- reg "getmarkets"
  return cbk err if err?
  try obj = JSON.parse(body)
  catch e
    return cbk(e)
  Object.keys(obj.result).forEach (pair) !-> list-pair.push(obj.result[pair].MarketName)
  LIST_PAIR := list-pair
  cbk null, list-pair

load-data-pair = (list_pair, cbk) ->
  err, body <- reg "getmarketsummaries"
  return cbk err if err?
  try obj = JSON.parse(body)
  catch e
    return cbk(e)

  pair_max_pr = {}
  Object.keys(obj.result).forEach (key) !->
    pair_max_pr[obj.result[key].MarketName] := do
      max_pr: (Math.abs(difference-between-numbers(obj.result[key].High, obj.result[key].Low))).toFixed(2)
      buy: obj.result[key].Bid
      sell: obj.result[key].Ask
      volume: +obj.result[key].Volume?.toFixed(2)
      quoteVolume: +obj.result[key].BaseVolume?.toFixed(2)
      change: difference-between-numbers(obj.result[key].PrevDay, obj.result[key].Last).toFixed(2)
  cbk null, pair_max_pr: pair_max_pr

reg = (method, cbk) ->
  err, resp, body <- request do
    timeout: 20000
    url: "https://bittrex.com/api/v1.1/public/#{method}"
  return cbk err if err?
  cbk null, body

html-data = (data, cbk) ->
  css = do
    green: "color: green"
    red: "color: red"

  bittrex = "<a href=https://monitor-volatility-bittrex.herokuapp.com>Bittrex</a>"
  btc-e = "<a href=https://monitor-volatility-btc-e.herokuapp.com>Btc-e</a>"
  poloniex = "<a href=https://monitor-volatility-poloniex.herokuapp.com>Poloniex</a>"

  end-time = Math.ceil((CACHE.date + ms("#{time_cache}m") - lodash.now!) / (1000 * 60))

  if !!ya-id
    metrika = "<!-- Yandex.Metrika counter --> <script type='text/javascript'> (function (d, w, c) { (w[c] = w[c] || []).push(function() { try { w.yaCounter#{ya-id} = new Ya.Metrika({ id:#{ya-id}, clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true, ut:'noindex' }); } catch(e) { } }); var n = d.getElementsByTagName('script')[0], s = d.createElement('script'), f = function () { n.parentNode.insertBefore(s, n); }; s.type = 'text/javascript'; s.async = true; s.src = 'https://mc.yandex.ru/metrika/watch.js'; if (w.opera == '[object Opera]') { d.addEventListener('DOMContentLoaded', f, false); } else { f(); } })(document, window, 'yandex_metrika_callbacks'); </script> <noscript><div><img src='https://mc.yandex.ru/watch/#{ya-id}?ut=noindex' style='position:absolute; left:-9999px;' alt='' /></div></noscript> <!-- /Yandex.Metrika counter -->"
  else
    metrika = ''

  html = [
    "<html><head>
    <title>Анализ волатильности торговых пар биржи Bittrex</title>
    <script type='text/javascript' src='/public/jquery.min.js'></script>
    <script type='text/javascript' src='/public/jquery.tablesorter.js'></script>
    <script type='text/javascript' src='/public/jquery.filtertable.min.js'></script>
    <link rel='stylesheet' href='/public/style.css' type='text/css'>
    <script type='text/javascript'>
      $(document).ready(function() {
        $('table').tablesorter();
        $('table').filterTable({
          label: 'Фильтр: ',
          placeholder: ''
        });
      });
    </script>
    #{metrika}
    </head><body>"
    "<h2>Анализ волатильности торговых пар биржи #{bittrex} (#{btc-e} | #{poloniex})</h2>"
    "<h3>Период: 24 ч. &nbsp;&nbsp; Время: #{new Date(CACHE.date).toLocaleTimeString('en-US', { timeZone: 'Europe/Moscow', hour12: false })} &nbsp;&nbsp;&nbsp; Обновление кэша через: #{end-time} мин. </h3>"
    "<table class='tablesorter'><thead><tr>
    <th>Пара</th>
    <th>% волотильности</th>
    <th>% change</th>
    <th>Ask</th>
    <th>Bid</th>
    <th>Стенка на Ask</th>
    <th>Стенка на Bid</th>
    <th>Volume</th>
    <th>Volume Fork</th>
    </tr></thead><tbody>"
  ]
  data.forEach (v) !->
    color = if v[8] > 0 then css.green else css.red
    if !lodash.isNaN +v[1]
      html.push "<tr>
        <td>#{v[0].replace('-', '/')}</td>
        <td>#{v[1]}</td>
        <td style='#{color}'>#{v[8]}</td>
        <td>#{v[2]}</td>
        <td>#{v[3]}</td>
        <td>#{v[4]}</td>
        <td>#{v[5]}</td>
        <td>#{v[6]}</td>
        <td>#{v[7]}</td>
        </tr>"
  html.push "</tbody></table><div class='donate'>BTC: 1GGbq5xkk9YUUy4QTqsUhNnc9T1n3sQ9Fo</div>"
  html.push "</body></html>"
  cbk html.join(" ")

loading = false
main = (res) ->
  if lodash.now! - CACHE.date > ms("#{time_cache}m")
    loading := true
    console.log "Started updating the cache ..."
    async.waterfall [
      (cbk) -> currency-pair-list cbk
      (data, cbk) -> order-book data, cbk
    ], (err) !->
        if err?
          loading := false
          text = "Error!"
          res.send text
          console.error "\nError: ", text-error err
        else
          err, data <-! load-data-pair LIST_PAIR
          if err?
            loading := false
            text = "Error!"
            res.send text
            console.error "\nError: ", text-error err
          else
            sortable = []
            Object.keys(data.pair_max_pr).forEach (key) !->
              if key in LIST_PAIR
                sortable.push(
                  [
                    key,
                    data.pair_max_pr[key].max_pr,
                    data.pair_max_pr[key].buy,
                    data.pair_max_pr[key].sell,
                    WALL_DATA[key].ask,
                    WALL_DATA[key].bid,
                    data.pair_max_pr[key].quoteVolume
                    data.pair_max_pr[key].volume,
                    data.pair_max_pr[key].change,
                  ]
                )
            sorted = sortable.sort((a,b) -> b[1] - a[1])
            console.log "Cache updated successfully"
            CACHE := do
              date: lodash.now!
              data: sorted
            html <-! html-data CACHE.data
            loading := false
            res.type("text/html")
            res.status(200)
            res.send html
  else
    html <-! html-data CACHE.data
    res.type("text/html")
    res.status(200)
    res.send html


request_n = 1
app.get('/', (req, res) ->
  if loading
    res.send "Упс... Данные еще загружаются. Перезапросите страницу через 10 секунд."
  else
    console.log "request №: #{request_n++}"
    main res
)

app.listen(server_port, ->
  console.log("App listening on port #{server_port}!")
)
