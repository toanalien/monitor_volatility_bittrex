// Generated by LiveScript 1.5.0
(function(){
  var path, async, lodash, request, express, compression, ms, favicon, app, server_port, time_cache, limitOrderBook, yaId, CACHE, WALL_DATA, LIST_PAIR, objToString, textError, differenceBetweenNumbers, percentageBetweenNumbers, flat_func, orderBook, orderBookPair, currencyPairList, loadDataPair, reg, htmlData, loading, main, request_n;
  path = require('path');
  async = require('async');
  lodash = require('lodash');
  request = require('request');
  express = require('express');
  compression = require('compression');
  ms = require('ms');
  favicon = require('serve-favicon');
  app = express();
  app.use(compression());
  app.use(favicon(path.join(__dirname, 'favicon.png')));
  app.use('/public', express['static']('public'));
  server_port = process.env.PORT || 3000;
  time_cache = process.env.TIME_CACHE || 10;
  limitOrderBook = process.env.LIMIT_ORDER_BOOK || 100;
  yaId = process.env.YA_ID;
  CACHE = {
    date: 0,
    data: []
  };
  WALL_DATA = {};
  LIST_PAIR = [];
  objToString = function(obj){
    var str;
    str = '';
    Object.keys(obj).forEach(function(p){
      if (obj.hasOwnProperty(p)) {
        return str += p + " :: " + obj[p] + "\n";
      }
    });
    return str;
  };
  textError = function(err){
    if (lodash.isObject(err)) {
      if (err.hasOwnProperty('error')) {
        return err.error;
      } else if (err.hasOwnProperty('message')) {
        return err.message;
      } else {
        return objToString(err);
      }
    } else {
      return err;
    }
  };
  differenceBetweenNumbers = function(a, b){
    return (b - a) / a * 100;
  };
  percentageBetweenNumbers = function(a, b){
    return +(100 * (a - b) / b).toFixed(1);
  };
  flat_func = function(x, y, z){
    return (z - x) / (y - x) * 100;
  };
  orderBook = function(list_pair, cbk){
    var x$;
    x$ = [];
    async.each(list_pair, function(pair){
      return x$.push(function(cbk){
        return orderBookPair(pair, cbk);
      });
    });
    async.parallel(x$, cbk);
    return x$;
  };
  orderBookPair = function(pair, cbk){
    var avg_percent;
    avg_percent = 300;
    return reg("getorderbook?market=" + pair + "&type=both&depth=" + limitOrderBook, function(err, body){
      var obj, e, objBuy, objSell, wallData, bid_sum, bid_avg, bid_index, ask_sum, ask_avg, ask_index;
      if (err != null) {
        return cbk(err);
      }
      try {
        obj = JSON.parse(body);
      } catch (e$) {
        e = e$;
        return cbk(e);
      }
      if (obj.result.buy == null || obj.result.sell == null) {
        WALL_DATA[pair] = {
          bid: 0,
          ask: 0
        };
        return cbk(null);
      }
      if (!obj.result.buy.length || !obj.result.sell.length) {
        WALL_DATA[pair] = {
          bid: 0,
          ask: 0
        };
        return cbk(null);
      }
      objBuy = obj.result.buy.splice(0, limitOrderBook);
      objSell = obj.result.sell.splice(0, limitOrderBook);
      wallData = {};
      bid_sum = lodash.sumBy(objBuy, function(v){
        return v.Quantity;
      });
      bid_avg = bid_sum / limitOrderBook;
      bid_index = lodash.findIndex(objBuy, function(v){
        return percentageBetweenNumbers(v.Quantity, bid_avg) > avg_percent;
      });
      ask_sum = lodash.sumBy(objSell, function(v){
        return v.Quantity;
      });
      ask_avg = ask_sum / limitOrderBook;
      ask_index = lodash.findIndex(objSell, function(v){
        return percentageBetweenNumbers(v.Quantity, ask_avg) > avg_percent;
      });
      WALL_DATA[pair] = {
        bid: bid_index >= 0 ? objBuy[bid_index].Rate : 'Не найдено',
        ask: ask_index >= 0 ? objSell[ask_index].Rate : 'Не найдено'
      };
      return cbk(null);
    });
  };
  currencyPairList = function(cbk){
    var listPair;
    listPair = [];
    return reg("getmarkets", function(err, body){
      var obj, e;
      if (err != null) {
        return cbk(err);
      }
      try {
        obj = JSON.parse(body);
      } catch (e$) {
        e = e$;
        return cbk(e);
      }
      Object.keys(obj.result).forEach(function(pair){
        listPair.push(obj.result[pair].MarketName);
      });
      LIST_PAIR = listPair;
      return cbk(null, listPair);
    });
  };
  loadDataPair = function(list_pair, cbk){
    return reg("getmarketsummaries", function(err, body){
      var obj, e, pair_max_pr;
      if (err != null) {
        return cbk(err);
      }
      try {
        obj = JSON.parse(body);
      } catch (e$) {
        e = e$;
        return cbk(e);
      }
      pair_max_pr = {};
      Object.keys(obj.result).forEach(function(key){
        var ref$, ref1$;
        pair_max_pr[obj.result[key].MarketName] = {
          max_pr: Math.abs(differenceBetweenNumbers(obj.result[key].High, obj.result[key].Low)).toFixed(2),
          buy: obj.result[key].Bid,
          sell: obj.result[key].Ask,
          volume: +((ref$ = obj.result[key].Volume) != null ? ref$.toFixed(2) : void 8),
          quoteVolume: +((ref1$ = obj.result[key].BaseVolume) != null ? ref1$.toFixed(2) : void 8),
          change: differenceBetweenNumbers(obj.result[key].PrevDay, obj.result[key].Last).toFixed(2),
          flat_24n: flat_func(obj.result[key].Low, obj.result[key].High, obj.result[key].Last).toFixed()
        };
      });
      return cbk(null, {
        pair_max_pr: pair_max_pr
      });
    });
  };
  reg = function(method, cbk){
    return request({
      timeout: 20000,
      url: "https://bittrex.com/api/v1.1/public/" + method
    }, function(err, resp, body){
      if (err != null) {
        return cbk(err);
      }
      return cbk(null, body);
    });
  };
  htmlData = function(data, cbk){
    var css, bittrex, btcE, poloniex, exmo, endTime, metrika, html;
    css = {
      green: "color: green",
      red: "color: red"
    };
    bittrex = "<a href=https://monitor-volatility-bittrex.herokuapp.com>Bittrex</a>";
    btcE = "<a href=https://monitor-volatility-btc-e.herokuapp.com>Btc-e</a>";
    poloniex = "<a href=https://monitor-volatility-poloniex.herokuapp.com>Poloniex</a>";
    exmo = "<a href=https://monitor-volatility-exmo.herokuapp.com>Exmo</a>";
    endTime = Math.ceil((CACHE.date + ms(time_cache + "m") - lodash.now()) / (1000 * 60));
    if (!!yaId) {
      metrika = "<!-- Yandex.Metrika counter --> <script type='text/javascript'> (function (d, w, c) { (w[c] = w[c] || []).push(function() { try { w.yaCounter" + yaId + " = new Ya.Metrika({ id:" + yaId + ", clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true, ut:'noindex' }); } catch(e) { } }); var n = d.getElementsByTagName('script')[0], s = d.createElement('script'), f = function () { n.parentNode.insertBefore(s, n); }; s.type = 'text/javascript'; s.async = true; s.src = 'https://mc.yandex.ru/metrika/watch.js'; if (w.opera == '[object Opera]') { d.addEventListener('DOMContentLoaded', f, false); } else { f(); } })(document, window, 'yandex_metrika_callbacks'); </script> <noscript><div><img src='https://mc.yandex.ru/watch/" + yaId + "?ut=noindex' style='position:absolute; left:-9999px;' alt='' /></div></noscript> <!-- /Yandex.Metrika counter -->";
    } else {
      metrika = '';
    }
    html = [
      "<html><head><title>Анализ волатильности торговых пар биржи Bittrex</title><script type='text/javascript' src='/public/jquery.min.js'></script><script type='text/javascript' src='/public/jquery.tablesorter.js'></script><script type='text/javascript' src='/public/jquery.filtertable.min.js'></script><link rel='stylesheet' href='/public/style.css' type='text/css'><script type='text/javascript'>$(document).ready(function() {$('table').tablesorter();$('table').filterTable({label: 'Фильтр: ',placeholder: ''});});</script>" + metrika + "</head><body>", "<h2>Анализ волатильности торговых пар биржи " + bittrex + " (" + btcE + " | " + poloniex + " | " + exmo + ")</h2>", "<h3>Период: 24 ч. &nbsp;&nbsp; Время: " + new Date(CACHE.date).toLocaleTimeString('en-US', {
        timeZone: 'Europe/Moscow',
        hour12: false
      }) + " &nbsp;&nbsp;&nbsp; Обновление кэша через: " + endTime + " мин. </h3>", "<table class='tablesorter'><thead><tr><th>Пара</th><th>диапазон хода %</th><th>уровень lastPrice % в<br>диапазоне хода</th><th>change %</th><th>Ask</th><th>Bid</th><th>Стенка на Ask</th><th>Стенка на Bid</th><th>Volume</th><th>Volume Fork</th></tr></thead><tbody>"
    ];
    data.forEach(function(v){
      var color;
      color = v[8] > 0
        ? css.green
        : css.red;
      if (!lodash.isNaN(+v[1])) {
        html.push("<tr><td>" + v[0].replace('-', '/') + "</td><td>" + v[1] + "</td><td>" + v[9] + "</td><td style='" + color + "'>" + v[8] + "</td><td>" + v[2] + "</td><td>" + v[3] + "</td><td>" + v[4] + "</td><td>" + v[5] + "</td><td>" + v[6] + "</td><td>" + v[7] + "</td></tr>");
      }
    });
    html.push("</tbody></table><div class='donate'></div>");
    html.push("</body></html>");
    return cbk(html.join(" "));
  };
  loading = false;
  main = function(res){
    if (lodash.now() - CACHE.date > ms(time_cache + "m")) {
      loading = true;
      console.log("Started updating the cache ...");
      return async.waterfall([
        function(cbk){
          return currencyPairList(cbk);
        }, function(data, cbk){
          return orderBook(data, cbk);
        }
      ], function(err){
        var text;
        if (err != null) {
          loading = false;
          text = "Exchange not available! Message: " + err;
          res.send(text);
          console.error("\nError: ", textError(err));
        } else {
          loadDataPair(LIST_PAIR, function(err, data){
            var text, sortable, sorted;
            if (err != null) {
              loading = false;
              text = "Exchange not available! Message: " + err;
              res.send(text);
              console.error("\nError: ", textError(err));
            } else {
              sortable = [];
              Object.keys(data.pair_max_pr).forEach(function(key){
                if (in$(key, LIST_PAIR)) {
                  sortable.push([key, data.pair_max_pr[key].max_pr, data.pair_max_pr[key].buy, data.pair_max_pr[key].sell, WALL_DATA[key].ask, WALL_DATA[key].bid, data.pair_max_pr[key].quoteVolume, data.pair_max_pr[key].volume, data.pair_max_pr[key].change, data.pair_max_pr[key].flat_24n]);
                }
              });
              sorted = sortable.sort(function(a, b){
                return b[1] - a[1];
              });
              console.log("Cache updated successfully");
              CACHE = {
                date: lodash.now(),
                data: sorted
              };
              htmlData(CACHE.data, function(html){
                loading = false;
                res.type("text/html");
                res.status(200);
                res.send(html);
              });
            }
          });
        }
      });
    } else {
      return htmlData(CACHE.data, function(html){
        res.type("text/html");
        res.status(200);
        res.send(html);
      });
    }
  };
  request_n = 1;
  app.get('/', function(req, res){
    if (loading) {
      return res.send("Упс... Данные еще загружаются. Перезапросите страницу через 10 секунд.");
    } else {
      console.log("request №: " + (request_n++));
      return main(res);
    }
  });
  app.listen(server_port, function(){
    return console.log("App listening on port " + server_port + "!");
  });
  function in$(x, xs){
    var i = -1, l = xs.length >>> 0;
    while (++i < l) if (x === xs[i]) return true;
    return false;
  }
}).call(this);
