from udf.texera_udf_operator_base import *
import math
from typing import List


class PyLinearRegressionOperator(TexeraUDFOperator):

    def __init__(self):
        super().__init__()
        self._data: List[pandas.Series] = []
        self._max_epoch = 100
        self._batch_size = 100
        self._epoch = 0
        self._mini_batch = 0
        self._x = None
        self._y = None
        self._learning_rate = 0.1
        self._b = 0
        self._w = 0
        self._w_gradient = 0
        self._b_gradient = 0

    def open(self, args: str):
        super().open(args)
        args_dict = {k[0].strip(): k[1].strip() for k in [i.split("=") for i in args.split(",")]}
        self._x = args_dict["x"]
        self._y = args_dict["y"]
        self._max_epoch = int(args_dict.get("max_epoch", "100"))

    def process_tuple(self, row: Union[pandas.Series, InputExhausted], nth_child: int) \
            -> Generator[Optional[pandas.Series], None, None]:
        if isinstance(row, InputExhausted):
            yield from self.learn()
        else:
            self._data.append(row)
            yield from []

    def learn(self) -> Generator[Optional[pandas.Series], None, None]:
        while self._epoch < self._max_epoch:
            self._epoch += 1
            self._mini_batch = 0
            while self._mini_batch < math.ceil(len(self._data) / self._batch_size):
                mini_batch_data = self._data[self._mini_batch:(self._mini_batch + self._batch_size)]
                mini_batch_x = [data.get(self._x) for data in mini_batch_data]
                mini_batch_y = [data.get(self._y) for data in mini_batch_data]
                print("epoch: " + str(self._epoch) + ", mini_batch: " + str(self._mini_batch))
                yield None

