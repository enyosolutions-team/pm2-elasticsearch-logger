const os = require('os');
const pmx = require('pmx');
const pm2 = require('pm2');
const request =	require('request');

pmx.initModule({}, (err, conf) => {
    if (err) {
        console.error('error on initalizing module', err.message);
    }

    const config = {
        index: conf.index || 'pm2',
        type: conf.type || '_doc',
        host: conf.host || os.hostname(),
        elasticUrl: conf.elasticUrl || 'http://localhost:9200',
        insecure: conf.insecure !== undefined ? conf.insecure : true
    };

    let url;
    let currentDate;

    function log(source, msg) {
        const d = new Date();

        const data = {
            '@timestamp': d.toISOString(),
            host: config.host,
            source,
            logger: 'pm2',
            id: msg.process.pm_id,
            process: msg.process.name,
            appName: msg.process.name,
            message: msg.data,
            level: source === 'stderr' ? 'error' : 'info',
            dataset: `${config.host}-${msg.process.name}`,
            host: {
                "hostname": config.host,
                "name": config.host,
            },
            beat: {
              "hostname": msg.process.name,
              "name": msg.process.name,
            },
            event: {
                "kind": "event",
                "host": {
                "hostname": config.host,
                "name": msg.process.name,
                }
            },
 
            tags: ['pm2', 'node', msg.process.name],
            agent: {
                name: 'filebeat'
            }
        };

        const body = JSON.stringify(data);

        const date = d.getDate();
        if (date !== currentDate) {
            const index = config.index + '-' + d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).substr(-2) + '.' + ('0' + date).substr(-2);
            console.log('sending logs to', config.elasticUrl + '/' + index + '/' + config.type);
            url = config.elasticUrl + '/' + index + '/' + config.type + '/';
            currentDate = date;
        }

        request.post({
            url,
            headers: {
                'Content-Type': 'application/json'
            },
            body,
            strictSSL: !config.insecure
        }, err => {
            if (err) {
                console.error('error on sending log message', err.message);
            }
        });
    }

    pm2.launchBus((err, bus) => {
        if (err) {
            console.error('error on launching pm2 bus', err.message);
        }

        bus.on('log:err', data => {
            if (data.process.name !== 'pm2-elasticsearch-logger') {
                log('stderr', data);
            }
        });

        bus.on('log:out', data => {
            if (data.process.name !== 'pm2-elasticsearch-logger') {
                log('stdout', data);
            }
        });
    });
});
