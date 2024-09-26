function addTemporaryDotToDocumentBody(x, y) {
  const el = document.createElement('span');
  el.classList.add('peer-dot');
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => {
    document.body.removeChild(el);
  }, 3500);
}

function random(min, max) {
  return min + Math.random() * (max + 1 - min);
}

const fireworkSetsToRemove = [];

const createFirework = (xPos, yPos) => {
  const colour = '#' + Math.random().toString(16).substr(2, 6);

  // Create 50 divs, start them on top of each other
  // so they can radiate out from the centre
  for (let i = 1; i <= 50; i++) {
    const firework = document.createElement('div');
    firework.className = 'firework';
    firework.classList.add(`firework${i}`);
    firework.classList.add(`set${set}`);
    firework.style.backgroundColor = colour;
    firework.style.left = xPos + 'px';
    firework.style.top = yPos + 'px';
    document.body.appendChild(firework);
    setTimeout(() => {
      console.log('Removing child', firework);
      document.body.removeChild(firework);
    }, 2500);
  }

  set += 1;
};

const deleteFirework = () => {
  const setToDelete = set - 3;
  if (set >= 0) {
    const oldFireworks = document.querySelectorAll(`.set${setToDelete}`);

    oldFireworks.forEach(firework => {
      firework.remove();
      console.log('removing firework', firework);
    });
  }
};

let set = 0;

function addExplodingFireworksToDocumentBody(x, y) {
  const el = document.createElement('span');
  el.classList.add('peer-dot');
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  document.body.appendChild(el);
  setTimeout(() => {
    document.body.removeChild(el);
  }, 3500);
}

function ConnectionBroker() {
  this.debug = true;
  this.connectionPool = {};
  this.peer = null;
  this.dataParser = (data, source) => {
    // console.log('parser input', {source, data});
    const coords = data.eventCoordinates;
    if (coords) {
      const { x, y } = coords;
      const { availWidth, height } = window.screen;
      const clientX = x * availWidth;
      const clientY = y * height;
    //   addTemporaryDotToDocumentBody(clientX, clientY);
      createFirework(clientX, clientY);
    }
  };

  document.addEventListener('click', event => {
    console.log({ event });
    if (this.peer === null) return;

    const { clientX, clientY } = event;
    const { availWidth, height } = window.screen;
    const eventCoordinates = {
      x: clientX / availWidth,
      y: clientY / height,
    };

    // addTemporaryDotToDocumentBody(clientX, clientY);
    createFirework(clientX, clientY);

    Object.keys(this.connectionPool).map(peerId => {
      this.connectionPool[peerId].send({
        message: `Hi there, I'm ${this.peer.id}`,
        eventCoordinates,
      });
    });
  });

  function resolveFirstAvailableId(template) {
    const prefix = template.prefix;
    const index = template.index;
    return new Promise(resolve => {
      const peer = new Peer(prefix + index);
      window.peer = peer;

      peer.on('open', function (id) {
        this.peer = peer;
        return resolve([id, peer]);
      });
      peer.on('error', function (err) {
        return resolve([null, peer]);
      });
    });
  }

  async function* getAvailableId(startingId) {
    let id = startingId;
    while (true) {
      yield await resolveFirstAvailableId({ prefix: 'fresha', index: id++ });
    }
  }

  async function generate() {
    for await (const val of getAvailableId(0)) {
      if (typeof val[0] === 'string') {
        return val[1];
      }
    }
  }

  const makeConnection = targetPeerId => {
    return new Promise(resolve => {
      const conn = this.peer.connect(targetPeerId);
      conn.on('open', () => {
        console.log('single connection opened:', conn.peer);
        this.connectionPool[conn.peer] = conn;
        resolve(conn);

        conn.on('data', data => {
          this.dataParser(data, conn.peer);
        });
      });
      conn.on('error', function (err) {
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
        console.log('conn.open', conn.open);
        if (conn.open) return;
        resolve(null);

        // this is not a good strategy
        console.log(
          'connection timeout',
          conn.peer,
          'remaining connections',
          Object.keys(this.connectionPool).length,
        );
        if (conn.peer in this.connectionPool && this.connectionPool[conn.peer].open === false) {
          delete this.connectionPool[conn.peer];
        }
      }, 1000);
    });
  };

  generate().then(connectedPeer => {
    this.peer = connectedPeer;
    console.log(
      `%cconnected to PeerServer as ${connectedPeer.id}`,
      'color: green; font-size: 16px;',
    );

    // separate listener for incoming connections
    connectedPeer.on('connection', newConnection => {
      console.log('new connection', newConnection);
      if (newConnection.peer in this.connectionPool) {
        console.log('connection already exists', newConnection.peer);
        return;
      }
      newConnection.on('open', data => {
        console.log(`Automatic connecton open with ${newConnection.peer}`, data);
        this.connectionPool[newConnection.peer] = newConnection;
      });
      newConnection.on('data', data => {
        this.dataParser(data, newConnection.peer);
      });

      newConnection.on('error', err => {
        console.log(`error`, err);
      });
    });

    const promiseArray = [
      makeConnection('fresha0'),
      makeConnection('fresha1'),
      makeConnection('fresha2'),
    ];
    Promise.all(promiseArray).then(connections => {
      console.log(
        `resolved ${connections.filter(Boolean).length} out of ${
          promiseArray.length
        } attempted connections`,
      );
    });
  });

  setInterval(() => {
    if (this.debug === true) {
      document.querySelector('#peers').innerHTML = '';
      Object.keys(this.connectionPool).map(peerId => {
        const li = document.createElement('li');
        li.innerHTML = peerId;
        document.querySelector('#peers').appendChild(li);
      });
    }
  }, 2000);

  window.cp = this.connectionPool;
}
