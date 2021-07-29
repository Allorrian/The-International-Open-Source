let allyList = require("allyList")

function towers(room, towers, creeps) {

    let injuredCreep = room.find(FIND_CREEPS, {
        filter: (c) => {
            return ((allyList().indexOf(c.owner.username.toLowerCase()) >= 0 || c.my) && c.hits < c.hitsMax * 0.75)
        }
    })[0]

    if (injuredCreep) {
        for (let tower of towers) {

            if (tower.energy > (tower.energyCapacity * .25)) {

                tower.heal(injuredCreep)

                room.visual.text("🩺 ", tower.pos.x + 1, tower.pos.y, { align: 'left' })
            }
        }
    } else {

        let injuredPowerCreep = room.find(FIND_POWER_CREEPS, {
            filter: (c) => {
                return ((allyList().indexOf(c.owner.username.toLowerCase()) >= 0 || c.my) && c.hits < c.hitsMax * 0.99)
            }
        })[0]

        if (injuredPowerCreep) {
            for (let tower of towers) {

                if (tower.energy > (tower.energyCapacity * .25)) {

                    tower.heal(injuredPowerCreep)

                    room.visual.text("🩺 ", tower.pos.x + 1, tower.pos.y, { align: 'left' })
                }
            }
        } else {

            let hostile = room.find(FIND_HOSTILE_CREEPS, {
                filter: (c) => {
                    return (allyList().indexOf(c.owner.username.toLowerCase()) === -1 && (c.body.some(i => i.type === ATTACK) || c.body.some(i => i.type === RANGED_ATTACK) || c.body.some(i => i.type === WORK) || c.body.some(i => i.type === CARRY) || c.body.some(i => i.type === CLAIM) || c.body.some(i => i.type === HEAL)))
                }
            })[0]

            if (hostile && room.find(FIND_MY_SPAWNS)[0] && (hostile.pos.inRangeTo(room.find(FIND_MY_SPAWNS)[0], 15) || hostile.hits < hostile.hitsMax * 0.75)) {

                for (let tower of towers) {

                    tower.attack(hostile)

                    room.visual.text("⚔️ ", tower.pos.x + 1, tower.pos.y, { align: 'left' })
                }
            } else {

                let logisticStructure = room.find(FIND_STRUCTURES, {
                    filter: (s) => (s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_CONTAINER) & s.hits < s.hitsMax * 0.1
                })[0]

                if (logisticStructure) {
                    for (let tower of towers) {

                        if (tower.energy > (tower.energyCapacity * .7)) {

                            tower.repair(logisticStructure)

                            room.visual.text("🔧 ", tower.pos.x + 1, tower.pos.y, { align: 'left' })

                            Memory.data.energySpentOnRepairs += 10
                        }
                    }
                } else {

                    let lowRampart = room.find(FIND_MY_STRUCTURES, {
                        filter: s => s.structureType == STRUCTURE_RAMPART && s.hits <= 1000
                    })[0]

                    if (lowRampart) {
                        for (let tower of towers) {

                            if (tower.energy > (tower.energyCapacity * .6)) {

                                tower.repair(lowRampart)

                                room.visual.text("🔧 ", tower.pos.x + 1, tower.pos.y, { align: 'left' })

                                Memory.data.energySpentOnBarricades += 10
                            }
                        }
                    }
                }
            }
        }
    }
}

module.exports = towers