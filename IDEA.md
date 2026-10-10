Tenho em mente um aplicativo feito com Nest.js, PostgreSQL e Typescript. A aplicação vai funcionar no esquema API/Frontend:

Homepage: um bloco parecido com um bloco de tweet do twitter. O "tweet" será chamado de "dump" (podemos decidir um nome mais adequado depois). UI sem nenhum detalhe extra. A ideia é que não haja fricção para criar uma nota. O design deve ser limpo, intuitivo e motivador de utilizar.

Usuário escreve qualquer coisa (e no mínimo uma tag. Ex: #Casa)
Usuário aperta enter e o dump é enviado
O dump é agrupada junto com outros dumps de acordo com essa tag. Caso não houver outro dump com essa tag, criar a tag.
Salva no banco de dados

A ideia é poder resgatar esse dump por tags para processamento posterior. O quickdump é um aplicativo para você ir fazendo pequenos "uploads" do que está pensando durante o dia. É uma ótima solução para blogs, por exemplo: Você entra, faz seu dump enquanto produz sem atrito. Depois, resgata os dumps e uma LLM ajuda a montar a história completa.

Não implemente nada com LLM's, isso foi só um exemplo.




