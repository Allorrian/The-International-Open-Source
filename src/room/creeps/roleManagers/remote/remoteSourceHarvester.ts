import { minHarvestWorkRatio, RemoteData } from 'international/constants'
import { customLog, findCarryPartsRequired, findObjectWithID, getRange, getRangeOfCoords, randomTick } from 'international/utils'
import { unpackPos, unpackPosList } from 'other/packrat'
import { RemoteHauler } from './remoteHauler'

export class RemoteHarvester extends Creep {
    constructor(creepID: Id<Creep>) {
        super(creepID)
    }

    public get dying(): boolean {
        // Inform as dying if creep is already recorded as dying

        if (this._dying) return true

        // Stop if creep is spawning

        if (!this.ticksToLive) return false

        if (this.memory.RN) {
            if (
                this.ticksToLive >
                this.body.length * CREEP_SPAWN_TIME +
                    Memory.rooms[this.memory.RN].SE[this.memory.SI] -
                    1 +
                    //I'm adding 20 to the theoritical value.  I'm frequently seeing the replacement harvesters
                    // not re-spawn in time because other creeps are spawning, and we end up losing out on a lot of
                    // energy because we miss a chance to farm.  -PR
                    20
            )
                return false
        } else if (this.ticksToLive > this.body.length * CREEP_SPAWN_TIME) return false

        // Record creep as dying

        return (this._dying = true)
    }

    preTickManager(): void {
        if (!this.findRemote()) return
        if (randomTick() && !this.getActiveBodyparts(MOVE)) this.suicide()

        const role = this.role as 'source1RemoteHarvester' | 'source2RemoteHarvester'

        // If the creep's remote no longer is managed by its commune

        if (!Memory.rooms[this.commune.name].remotes.includes(this.memory.RN)) {
            // Delete it from memory and try to find a new one

            this.removeRemote()
            if (!this.findRemote()) return
        }

        if (this.dying) return

        // Reduce remote need

        Memory.rooms[this.memory.RN].data[RemoteData[role]] -= this.parts.work

        const commune = this.commune

        // Add the creep to creepsOfRemote relative to its remote

        if (commune && commune.creepsOfRemote[this.memory.RN])
            commune.creepsOfRemote[this.memory.RN][role].push(this.name)
    }

    /**
     * Finds a remote to harvest in
     */
    findRemote?(): boolean {
        if (this.memory.RN) return true

        const role = this.role as 'source1RemoteHarvester' | 'source2RemoteHarvester'

        for (const remoteInfo of this.commune?.remoteSourceIndexesByEfficacy) {
            const splitRemoteInfo = remoteInfo.split(' ')
            const remoteName = splitRemoteInfo[0]
            const sourceIndex = parseInt(splitRemoteInfo[1])
            const remoteMemory = Memory.rooms[remoteName]

            // If the sourceIndexes aren't aligned

            if (sourceIndex !== this.memory.SI) continue

            // If there is no need

            if (remoteMemory.data[RemoteData[role]] <= 0) continue

            this.assignRemote(remoteName)
            return true
        }

        return false
    }

    assignRemote?(remoteName: string) {
        this.memory.RN = remoteName

        if (this.dying) return

        const role = this.role as 'source1RemoteHarvester' | 'source2RemoteHarvester'

        const needs = Memory.rooms[remoteName].data

        needs[RemoteData[role]] -= this.parts.work
    }

    removeRemote?() {
        if (!this.dying) {
            const role = this.role as 'source1RemoteHarvester' | 'source2RemoteHarvester'

            const needs = Memory.rooms[this.memory.RN].data

            needs[RemoteData[role]] += this.parts.work
        }

        delete this.memory.RN
    }

    remoteActions?() {
        // Try to move to source. If creep moved then iterate
        if (this.travelToSource(this.memory.SI)) return

        const container = this.getContainer()
        let figuredOutWhatToDoWithTheEnergy = false

        const source = this.room.sources[this.memory.SI]

        //1) feed remote hauler
        //2) build if "ahead of the curve"
        //3) drop mine
        //4) means you're idle, try building the container.

        //If we're going to be overfilled after the next harvest, figure out what to do with the extra energy.
        if (this.store.getFreeCapacity() <= this.getActiveBodyparts(WORK) || source.energy == 0) {
            //See if there's a hauler to tranfer to if we're full so we're not drop mining.
            //   This shouldn't run if we're container mining however.
            if (!container) {
                let haulers = this.room.myCreeps.remoteHauler?.map(name => Game.creeps[name] as RemoteHauler)
                if (haulers && haulers.length > 0) {
                    let nearby = haulers.find(haul => haul.pos.isNearTo(this.pos))
                    if (nearby) {
                        let transResult = this.transfer(nearby, RESOURCE_ENERGY)
                        if (transResult == OK) {
                            this.movedResource = true
                            //We won't have energy, so don't consider maintenance.
                            figuredOutWhatToDoWithTheEnergy = true
                        }
                    }
                }
            }

            //if we're ahead of the curve...  As in we're beating the regen time of the source.
            //  Aka  source.energy / source.energyCapacity <  source.ticksToRegeneration / 300
            //  It's rearranged for performance.  This will also repair the container if needed.
            if (
                !figuredOutWhatToDoWithTheEnergy &&
                source.energy * 300 < (source.ticksToRegeneration - 1) * source.energyCapacity
            ) {
                let didWork = this.doContainerMaintance()
                //If we did container maintance, that'll eat our work action.
                if (didWork) return
            }

            //If we get here and we still haven't figured out what to do about the energy, see
            //  If we should drop mine, or transfer.
            if (!figuredOutWhatToDoWithTheEnergy && container && !container.pos.isEqualTo(this.pos)) {
                this.transfer(container, RESOURCE_ENERGY)
            }
        }

        if (this.advancedHarvestSource(source)) return
    }

    private obtainEnergyIfNeeded() {
        let neededEnergy = this.parts.work * BUILD_POWER
        //We need to check to see if there's enough for the current tick, plus the next tick, otherwise
        //  We need to pick up on this tick, which is why the *2 is there.
        if (this.store[RESOURCE_ENERGY] < neededEnergy * 2) {
            let droppedResource = this.pos
                .findInRange(FIND_DROPPED_RESOURCES, 1)
                .find(drop => drop.resourceType == RESOURCE_ENERGY)
            if (droppedResource) this.pickup(droppedResource)
        }
    }

    getContainerPosition(): RoomPosition {
        return this.room.sourcePositions[this.memory.SI][0]
    }

    getContainer(): StructureContainer {
        let containerPosition = this.getContainerPosition()
        return this.room
            .lookForAt(LOOK_STRUCTURES, containerPosition)
            .find(st => st.structureType == STRUCTURE_CONTAINER) as StructureContainer
    }

    doContainerMaintance(): boolean {
        let containerPosition = this.getContainerPosition()
        let container = this.getContainer()
        if (container) {
            //If the container is below 80% health, repair it.
            if (container.hits < container.hitsMax * 0.8) {
                this.obtainEnergyIfNeeded()
                this.repair(container)
                return true
            }
            return false
        }

        //So there's not a container.  Is there a construction site?
        let constructionSite = this.room
            .lookForAt(LOOK_CONSTRUCTION_SITES, containerPosition)
            .find(st => st.structureType == STRUCTURE_CONTAINER)
        if (constructionSite) {
            //This needs to check to see how we're doing on energy, and pick it up off the ground if needed.
            this.obtainEnergyIfNeeded()
            this.build(constructionSite)

            //The container gets built slowly, so delete the tracking flag each time we build.  We don't want the
            //   container cancelled.
            delete Memory.constructionSites[constructionSite.id]
            return true
        }

        //So no container, no construction site.  Let's create one...  This probably needs some guards to make sure we're not creating
        //  too many construction sites.
        this.room.createConstructionSite(containerPosition, STRUCTURE_CONTAINER)

        return false
    }

    /**
     *
     */
    travelToSource?(sourceIndex: number): boolean {

        this.say('🚬')

        // Unpack the harvestPos

        const harvestPos = this.findSourcePos(this.memory.SI)
        if (!harvestPos) return true

        // If the creep is at the creep's packedHarvestPos, inform false

        if (getRangeOfCoords(this.pos, harvestPos) === 0) return false

        // Otherwise say the intention and create a moveRequest to the creep's harvestPos, and inform the attempt

        this.say(`⏩ ${sourceIndex}`)

        this.createMoveRequest({
            origin: this.pos,
            goals: [
                {
                    pos: new RoomPosition(harvestPos.x, harvestPos.y, this.memory.RN),
                    range: 0,
                },
            ],
            avoidEnemyRanges: true,
            typeWeights: {
                enemyRemote: Infinity,
                enemy: Infinity,
            },
        })

        return true
    }

    static RemoteHarvesterManager(room: Room, creepsOfRole: string[]) {
        for (const creepName of creepsOfRole) {
            const creep: RemoteHarvester = Game.creeps[creepName] as RemoteHarvester

            // Try to find a remote

            if (!creep.findRemote()) {
                // If the room is the creep's commune

                if (room.name === creep.commune.name) {
                    // Advanced recycle and iterate

                    creep.advancedRecycle()
                    continue
                }

                // Otherwise, have the creep make a moveRequest to its commune and iterate

                creep.createMoveRequest({
                    origin: creep.pos,
                    goals: [
                        {
                            pos: new RoomPosition(25, 25, creep.commune.name),
                            range: 25,
                        },
                    ],
                })

                continue
            }

            // If the creep needs resources

            if (room.name === creep.memory.RN) {
                creep.remoteActions()
                continue
            }

            creep.say(creep.memory.RN)

            const sourcePos = unpackPosList(Memory.rooms[creep.memory.RN].SP[creep.memory.SI])[0]

            const createMoveRequestResult = creep.createMoveRequest({
                origin: creep.pos,
                goals: [
                    {
                        pos: sourcePos,
                        range: 1,
                    },
                ],
                avoidEnemyRanges: true,
                typeWeights: {
                    enemy: Infinity,
                    ally: Infinity,
                    keeper: Infinity,
                    enemyRemote: Infinity,
                    allyRemote: Infinity,
                },
                avoidAbandonedRemotes: true,
            })

            if (createMoveRequestResult === 'unpathable') {

                Memory.rooms[creep.memory.RN].data[RemoteData.abandon] = 1500
                creep.removeRemote()
            }
        }
    }
}
