import { createReactive } from '../core/create-reactive';

const reactive = <S>(target: S): S => {
    return createReactive(target) as S;
};

export default reactive;
