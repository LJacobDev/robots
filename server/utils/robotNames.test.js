import { describe, it, expect } from 'vitest';
import { assignRobotNames } from './robotNames.js';

describe('assignRobotNames', () => {
  it('1 robot returns ["Robbie"]', () => {
    expect(assignRobotNames(1)).toEqual(['Robbie']);
  });

  it('3 robots returns ["Robbie", "Jane", "Bob"]', () => {
    expect(assignRobotNames(3)).toEqual(['Robbie', 'Jane', 'Bob']);
  });

  it('20 robots returns all 20 base names in order', () => {
    const result = assignRobotNames(20);
    expect(result).toHaveLength(20);
    expect(result[0]).toBe('Robbie');
    expect(result[1]).toBe('Jane');
    expect(result[2]).toBe('Bob');
    expect(result[19]).toBe('Rachel');
  });

  it('21 robots appends "Robbie_2" as the 21st name', () => {
    const result = assignRobotNames(21);
    expect(result).toHaveLength(21);
    expect(result[20]).toBe('Robbie_2');
  });

  it('40 robots fills first cycle then second cycle with _2 suffix', () => {
    const result = assignRobotNames(40);
    expect(result).toHaveLength(40);
    expect(result[0]).toBe('Robbie');
    expect(result[19]).toBe('Rachel');
    expect(result[20]).toBe('Robbie_2');
    expect(result[39]).toBe('Rachel_2');
  });

  it('41 robots starts the _3 cycle', () => {
    const result = assignRobotNames(41);
    expect(result).toHaveLength(41);
    expect(result[40]).toBe('Robbie_3');
  });
});