import { MachineState, StateMachine } from './index';
import { IHistory } from './interfaces';
import { InputMapping } from './util';

/**
 * The HistoryManager class manages the state/history of a program.
 */
export class HistoryManager<S extends MachineState> implements IHistory<S> {
  private _maxHistory: number = Infinity;
  private _inputKeys: (keyof S)[] = [];

  /**
   * Constructor with an initial state.
   * @param _instance The state machine instance.
   * @param {S} _initialState The initial program state.
   * @param _inputs An input mapping.
   */
  /** @internal */
  constructor(protected _instance: StateMachine<S>, protected readonly _initialState: S,
    protected readonly _inputs: Set<InputMapping<S, any>>)
  {
    _inputs.forEach(input => this._inputKeys.push(input.key));
    this._initialState = Object.assign(Object.create(null), _initialState, this._collectInputs());
    this._nextState = Object.assign(Object.create(null), this._initialState);
    this._nextTick();
  }

  private _records: S[] = [];

  /**
   * Returns the entire state history.
   * @returns {ReadonlyArray<S extends MachineState>}
   */
  get records(): ReadonlyArray<S> {
    return this._records;
  }

  private _tick: number = 0;

  /**
   * Get the current tick number.
   * @returns {number}
   */
  get tick() {
    return this._tick;
  }

  private _nextState: Partial<S>;

  /**
   * Returns the next state being updated.
   * @returns {Partial<S extends MachineState>}
   */
  get nextState(): Readonly<Partial<S>> {
    return this._nextState;
  }

  /**
   * Return the maximum number of history states to keep.
   * @returns {number}
   */
  get limit() {
    return this._maxHistory;
  }

  /**
   * Limit the number of recorded history states.
   */
  set limit(limit: number) {
    if (limit < 1) limit = 1;
    if (limit < this._maxHistory) {
      // trim back the record history.
      this._records.splice(0, this._records.length - limit);
    }
    this._maxHistory = limit;
  }

  /**
   * Returns the initial state.
   * @returns {Partial<S extends MachineState>}
   */
  get initialState(): Readonly<S> {
    return this._initialState;
  }

  /**
   * Returns the current state.
   * @returns {Partial<S extends MachineState>}
   */
  get currentState(): Readonly<S> {
    return this.records[this.records.length - 1] || this._nextState;
  }

  /**
   * Rewind time by `n` times, the rest of the currently executing tick will be
   * aborted.A partial state can be passed as the second argument to mutate the
   * rewound state and bring back information in time from the future state.
   * @param {number} n The number of times to rewind, defaults to Infinity.
   * @param {Partial<S extends MachineState>} mutate Any mutations to apply to
   *  the state after rewinding.
   */
  rewind(n: number, mutate?: Partial<S>) {
    if (n <= this._maxHistory && Number.isFinite(n)) {
      this._records.splice(n, this.records.length - n);
      this._tick -= n;
    }
    else {
      this._records.splice(0, this._records.length);
      this._tick = 0;
      this._records.push(this._initialState);
    }

    if (mutate) {
      this._records[this._records.length - 1] =
        Object.assign(Object.create(null),
          this.currentState, mutate
        ) as S;
    }

    this._beginTick();
  }

  /**
   * Clears the state history. Rewinds to the beginning, and the rest of the
   * current tick will be ignored.
   */
  clear() {
    this.rewind(Infinity);
  }

  /** @internal */
  _mutateTick(p: Partial<S>) {
    for(let k of this._inputKeys)
      delete p[k];
    return Object.assign(this._nextState, p);
  }

  /** @internal */
  _nextTick() {
    const nextState = this.nextState as Readonly<S>;
    this._records.push(nextState);
    if (this.records.length > this._maxHistory) {
      this._records.splice(
        0,
        this.records.length - this._maxHistory
      );
    }
    this._beginTick();
    this._tick++;
  }

  /** @internal */
  protected _beginTick() {
    return this._nextState = Object.assign(
      Object.create(null),
      this.records[this.records.length - 1],
      this._collectInputs()
    );
  }

  /** @internal */
  _collectInputs() {
    const inputs: Partial<S> = Object.create(null);
    for (let input of this._inputs) {
      const value = this._instance[input.propertyKey as keyof StateMachine<S>];
      inputs[input.key as keyof S] =
        input.transform ? input.transform.call(this._instance, value) : value;
    }
    return inputs;
  }

}
