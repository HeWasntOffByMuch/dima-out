function addTemporaryDotToDocumentBody(x, y) {
    const el = document.createElement('span');
    el.classList.add('peer-dot');
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => {
        document.body.removeChild(el);
    }, 3500)
}

function ConnectionBroker() {
    this.debug = true;
    this.connectionPool = {};
    this.peer = null;
    this.dataParser = (data, source) => {
        // console.log('parser input', {source, data});
        const coords = data.eventCoordinates;
        if (coords) {
            const {x, y} = coords;
            const {availWidth, height} = window.screen;
            const clientX = x * availWidth;
            const clientY = y * height;
            addTemporaryDotToDocumentBody(clientX, clientY);
        }
    }

    document.addEventListener('click', event => {
        console.log({event})
        if (this.peer === null) return;

        const {clientX, clientY} = event;
        const { availWidth, height } = window.screen;
        const eventCoordinates = {
            x: clientX / availWidth,
            y: clientY / height,
        };

        addTemporaryDotToDocumentBody(clientX, clientY);

        Object.keys(this.connectionPool).map(peerId => {
            this.connectionPool[peerId].send({
                message: `Hi there, I'm ${this.peer.id}`,
                eventCoordinates,
            })
        });
    })


    function resolveFirstAvailableId(template) {
        const prefix = template.prefix;
        const index = template.index;
        return new Promise(resolve => {
            const peer = new Peer(prefix + index);
            window.peer = peer;

            peer.on('open', function(id) {
                this.peer = peer;
                return resolve([id, peer]);
            });
            peer.on('error', function(err) {
                return resolve([null, peer])
            })
        });
    }

    async function* getAvailableId(startingId) {
        let id = startingId;
        while(true) {
            yield await resolveFirstAvailableId({prefix: 'fresha', index: id++});
        }
    }

    async function generate() {
        for await (const val of getAvailableId(0)) {
            if (typeof val[0] === 'string') {
                return val[1];
            }
        }
    }

    const makeConnection = (targetPeerId) => {
        return new Promise(resolve => {
            const conn = this.peer.connect(targetPeerId);
            conn.on('open', () => {
                console.log('single connection opened:', conn.peer);
                this.connectionPool[conn.peer] = conn;
                resolve(conn);

                conn.on('data', data => {
                    this.dataParser(data, conn.peer);
                })
            });
            conn.on('error', function(err) {
                console.log('single connection error', err);
                resolve(null);
            });

            conn.on('close', err => {
                console.log('single connection close', err);
                if (conn.peer in this.connectionPool) {
                    delete this.connectionPool[conn.peer];
                }
                resolve(null);
            });
            // connection timeout handler
            setTimeout(() => {
                console.log('conn.open', conn.open)
                if (conn.open) return;
                resolve(null)

                // this is not a good startegy
                console.log('connection timeout', conn.peer, 'remaining connections', Object.keys(this.connectionPool).length)
                if (conn.peer in this.connectionPool && this.connectionPool[conn.peer].open === false) {
                    delete this.connectionPool[conn.peer];
                }
            }, 1000)
        });
    }

    generate().then(connectedPeer =>{
        this.peer = connectedPeer;
        console.log(`%cconnected to PeerServer as ${connectedPeer.id}`, 'color: green; font-size: 16px;');

        // separate listener for incoming connections
        connectedPeer.on('connection', newConnection => {
            console.log('new connection', newConnection)
            if (newConnection.peer in this.connectionPool) {
                console.log('connection already exists', newConnection.peer);
                return;
            }
            newConnection.on('open', data => {
                console.log(`Automatic connecton open with ${newConnection.peer}`, data);
                this.connectionPool[newConnection.peer] = newConnection;
            })
            newConnection.on('data', data => {
                this.dataParser(data, newConnection.peer);
            })

            newConnection.on('error', err => {
                console.log(`error`, err);
            });
        });

        const promiseArray = [makeConnection('fresha0'), makeConnection('fresha1'), makeConnection('fresha2')];
        Promise.all(promiseArray).then(connections => {
            console.log(`resolved ${connections.filter(Boolean).length} out of ${promiseArray.length} attempted connections`)
        })
    })

    setInterval(() => {
        if (this.debug === true) {
            document.querySelector('#peers').innerHTML = '';
            Object.keys(this.connectionPool).map(peerId => {
                const li = document.createElement('li');
                li.innerHTML = peerId;
                document.querySelector('#peers').appendChild(li);
            })
        }
    }, 2000);

    window.cp = this.connectionPool;
}