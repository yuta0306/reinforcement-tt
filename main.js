const CELLS = document.getElementsByClassName("cell"),
    WIN = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

let flag;
let trainer;
let mode = false;

const START = document.getElementsByClassName('start')[0],
        STOP = document.getElementsByClassName('stop')[0],
        BATTLE = document.getElementsByClassName('battle')[0],
        REWARDS = document.getElementsByClassName('rewards')[0],
        DEMO = document.getElementsByClassName('demo')[0],
        EPOCH = document.getElementsByClassName('epoch')[0];

class Agent {
    constructor(turn, params=null, records=null) {  // enemy: Agent class
        this.turn = turn;
        this.params = params || {};
        this.records = records || {};
        this.reward = -10000;
    }

    set_enemy = (enemy) => {
        this.enemy = enemy;
    }

    environ = (train=true) => {
        let record = "";
        let movable = [];
        let cell;

        for (let i=0; i<CELLS.length; i++) {
            cell = CELLS[i]
            if (cell.classList.contains("player")) record += "1";
            else if (cell.classList.contains("enemy")) record += "-1";
            else {
                record += "0";
                movable.push(i);
            }
        }

        return {'record': record, 'movable': movable};
    }

    decide = (record, movable) => {  // return index of cell to move
        let proba, threshold = [], tmp_thresh = 0, move, i;
        if (this.params[record] == undefined) {
            proba = movable.map(x => 1 / movable.length);
        } else {
            proba = this.params[record];
        }

        threshold = proba.map(x => {
            tmp_thresh += x;
            return tmp_thresh;
        });
        proba = proba.map(x => {
            x = x / tmp_thresh
            if (x == Infinity) x = 1;
            else if (x < 1e-5) x = 1e-5;
            
            return x;
        });
        this.params[record] = proba;

        tmp_thresh = 0;
        threshold = proba.map(x => {
            tmp_thresh += x;
            return tmp_thresh;
        });

        move = Math.random() * tmp_thresh;
        for (i=0; i<threshold.length; i++) {
            if (i == 0) {
                if (move <= threshold[i]) {
                    move = movable[i];
                    this.records[record] = i;

                    return move;
                }
            }
            else {
                if ((threshold[i-1] < move) && (move <= threshold[i])) {
                    move = movable[i];
                    this.records[record] = i;

                    return move;
                }
            }
        }
        move = movable[i];
        this.records[record] = i;

        return move;
    }

    action = (move, train=false) => {
        try {
            if (this.turn == "player") CELLS[move].innerHTML = '○';
            else if (this.turn == "enemy") CELLS[move].innerHTML = 'X';
            CELLS[move].classList.add(this.turn);
            CELLS[move].classList.remove("active");

            return true;
        }
        catch (e) {
            if (train) {
                this.reward += 3;
                this.enemy.reward += 3;
            }

            return false;
        }
    }

    observe = judge => {
        let result = judge(this.turn);
        let key;
        if (result) {
            for (key in this.records) {
                try {
                    this.params[key][this.records[key]] += 0.02;
                } catch (e) {
                    console.log(e);
                }
            }
            this.reward += 5;

            // enemy
            for (key in this.enemy.records) {
                try {
                    this.enemy.params[key][this.enemy.records[key]] -= 0.02;
                } catch (e) {
                    console.log(e);
                }
            }
            this.enemy.reward -= 8;

            return true;
        }
        else {
            for (key in this.records) {
                try {
                    if (this.turn == 'player')
                        this.params[key][this.records[key]] -= 0.0004;
                    else if (this.turn == 'enemy')
                        this.params[key][this.records[key]] += 0.0002;
                } catch (e) {
                    console.log(e);
                }
            }
            // enemy
            for (key in this.enemy.records) {
                try {
                    if (this.enemy.turn == 'player')
                        this.enemy.params[key][this.enemy.records[key]] -= 0.0004;
                    else if (this.enemy.turn == 'enemy')
                        this.enemy.params[key][this.enemy.records[key]] += 0.0002;
                } catch (e) {
                    console.log(e);
                }
            }

            if (this.turn == 'enemy') this.reward += 0.5;
            
            return false;
        }
    }
}

class Train {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.steps = 0;

        this.player.set_enemy(this.enemy);
        this.enemy.set_enemy(this.player);
    }

    train = () => {
        init();
        let flag;
        while (true) {
            flag = battle(this.player);
            if (!flag) break;
            flag = battle(this.enemy);
            if (!flag) break;
        }

        // Initialize records
        this.player.records = {};
        this.enemy.records = {};
        this.steps++;
    }
}

class Demo {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;

        this.player.set_enemy(this.enemy);
        this.enemy.set_enemy(this.player);
    }

    demo = (interval) => {
        init();
        let count=0, flag, win;
        flag = setInterval(() => {
            if (count % 2 == 0) win = test_battle(this.player);
            else win = test_battle(this.enemy);

            if (win == 'w') {
                if (count % 2 == 0) alert('Winner: Player');
                else alert('Winner: Enemy');
                clearInterval(flag);
            } else if (win == 'd') {
                alert('Drow');
                clearInterval(flag);
            }
            count++;
        }, interval);
    }
}


let battle = (agent) => {
    let {record, movable} = agent.environ();

    if (movable.length < 1) return false;
    move = agent.decide(record, movable);
    if (!agent.action(move, true)) return false;
    win = agent.observe(judge);
    if (win) return false;

    return true;
}

let test_battle = (agent) => {
    let {record, movable} = agent.environ();

    if (movable.length < 1) return 'd';
    move = agent.decide(record, movable);
    if (!agent.action(move)) return 'd'
    win = judge(agent.turn);
    if (win) return 'w';
}

let judge = (side, states=null) => {
    let filled = states || [],
        count;

    for (let i=0; i<CELLS.length; i++) {
        if (CELLS[i].classList.contains(side)) filled.push(i);
    }
    for (elms of WIN) {
        count = 0;
        elms.forEach(elm => {
            if (filled.includes(elm)) count++;
        })
        if (count == 3) {
            break;
        }
    }

    if (count === 3) {
        return true;
    }
    else return false;
}

let init = () => {
    for (cell of CELLS) {
        cell.innerHTML = "";
        cell.classList.remove("player");
        cell.classList.remove("enemy");
        cell.classList.add("active");
    }
}

let deactivate = (CELLS) => {
    for (cell of CELLS) {
        cell.classList.remove("active");
    }
}


START.addEventListener('click', e => {
    if (!mode) {
        let player = new Agent('player');
        let enemy = new Agent('enemy');
        let steps = 1000000, count = 1;
        mode = true;

        trainer = new Train(player, enemy);
        flag = setInterval(() => {
            trainer.train();
            EPOCH.innerHTML = `Steps: ${count}`
            REWARDS.innerHTML = `P_reward: ${trainer.player.reward} | E_reward: ${trainer.enemy.reward}`
            count++;
            if (count > steps) clearInterval(flag);
        }, 5);
    }
})

STOP.addEventListener('click', e => {
    mode = false;
    clearInterval(flag);
    // console.log(trainer.player.params);
    // console.log(trainer.enemy.params);
})

DEMO.addEventListener('click', e => {
    if (!mode) {
        mode = true;
        let tester = new Demo(trainer.player, trainer.enemy);
        tester.demo(300);
    }
    mode = false;
})

BATTLE.addEventListener('click', e => {
    if (!mode) init();
})

if (!mode) {
    for (cell of CELLS) {
        cell.addEventListener('click', function(e) {
            if (this.classList.contains("active")) {
                this.innerHTML = '○';
                this.classList.add("player");
                this.classList.remove("active");
                if (judge("player")) {
                    deactivate(CELLS);
                    alert("playerの勝利です!");
                } else {
                    let {record, movable} = trainer.enemy.environ();
                    move = trainer.enemy.decide(record, movable);
                    trainer.enemy.action(move);
    
                    if (judge("enemy")) {
                        deactivate(CELLS);
                        alert("enemyの勝利です...");
                    }
                }
            }
        });
    }
}
