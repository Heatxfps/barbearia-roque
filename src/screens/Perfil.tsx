import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { api } from '../api'
import { useApp } from '../contexto'
import { useState } from 'react'
import CampoAniversario, { aniversarioOk } from '../components/CampoAniversario'
import { aniversarioTxt, foto, formatarTelefone, linkWhats } from '../util'
import { Ornamento } from './Inicio'

const B = import.meta.env.BASE_URL
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const h = (s: string) => s.replace(':00', 'h').replace(':', 'h')

export default function Perfil({ navegar }: { navegar: Navegar }) {
  const { barbearia, cliente, definirCliente } = useApp()
  if (!barbearia) return null
  const hoje = new Date().getDay()

  return (
    <div className="tela">
      <header className="sobre" style={{ backgroundImage: `url(${B}img/fundo-parede.jpg)` }}>
        <div className="sobre__sombra" />
        <span className="sobre__legenda">Nosso espaço · {barbearia.cidade.split(' - ')[0]}</span>
      </header>

      <p className="manifesto">
        Mais que um corte: um ritual. Ambiente clássico, atendimento no detalhe e o melhor da barbearia
        tradicional em Nova Venécia.
      </p>

      {barbearia.dono && (
        <>
          <Ornamento texto="O fundador" />
          <section className="fundador">
            {barbearia.dono.foto && <img src={foto(barbearia.dono.foto)} alt={barbearia.dono.nome} loading="lazy" />}
            <div className="fundador__texto">
              <p className="sobretitulo">Fundador</p>
              <h2 className="titulo-editorial pequeno-ed">{barbearia.dono.nome}</h2>
              <p className="suave">
                Clássico na essência, moderno no estilo. À frente da Roque, {barbearia.dono.nome.split(' ')[0]} une a tradição
                da barbearia a um olhar atual, no ambiente, no atendimento e em cada detalhe.
              </p>
            </div>
          </section>
        </>
      )}

      <button className="item" onClick={() => navegar('loja')}>
        <div className="item__com-avatar"><Icone nome="sacola" /><div><strong>Loja da Roque</strong><span className="suave">Reserve pelo app e retire na barbearia</span></div></div>
        <Icone nome="seta" />
      </button>
      <button className="item" onClick={() => navegar('noivo')}>
        <div className="item__com-avatar"><Icone nome="fidelidade" /><div><strong>Dia do Noivo</strong><span className="suave">Making of e cuidado completo para o grande dia</span></div></div>
        <Icone nome="seta" />
      </button>

      <div className="lista">
        <a className="item" href={linkWhats(barbearia.whatsapp)} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="whats" /><div><strong>WhatsApp</strong><span className="suave">Fale com a gente</span></div></div>
          <Icone nome="seta" />
        </a>
        <a className="item" href={`https://instagram.com/${barbearia.instagram}`} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="insta" /><div><strong>Instagram</strong><span className="suave">@{barbearia.instagram}</span></div></div>
          <Icone nome="seta" />
        </a>
        <a className="item" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${barbearia.nome} ${barbearia.cidade}`)}`} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="local" /><div><strong>Como chegar</strong><span className="suave">{barbearia.endereco}</span></div></div>
          <Icone nome="seta" />
        </a>
      </div>

      <Ornamento texto="Horários" />
      <section className="cartao horarios">
        {DIAS.map((d, i) => {
          const x = barbearia.horarios[i]
          return (
            <div key={d} className={`linha-entre ${i === hoje ? 'hoje' : ''}`}>
              <span>{d}</span>
              <span>{x ? `${h(x[0])} – ${h(x[1])}` : 'Fechado'}</span>
            </div>
          )
        })}
      </section>

      {cliente && <SuaConta />}

      <p className="rodape">v1.0 · {api.modo === 'local' ? 'modo demonstração offline' : 'conectado'}</p>
    </div>
  )
}

function SuaConta() {
  const { cliente, definirCliente, barbearia, avisar } = useApp()
  const [editando, setEditando] = useState(false)
  const [aniv, setAniv] = useState(cliente?.aniversario ?? '')
  if (!cliente) return null
  const salvar = async () => {
    try {
      await api.atualizarPerfil({ aniversario: aniversarioOk(aniv) ? aniv : null })
      definirCliente(await api.eu()); setEditando(false); avisar('Aniversário salvo')
    } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <>
      <Ornamento texto="Sua conta" />
      <section className="cartao">
        <strong>{cliente.nome}</strong>
        <p className="suave">{formatarTelefone(cliente.telefone)}</p>
        {editando ? (
          <>
            <CampoAniversario valor={aniv} mudar={setAniv} rotulo="Aniversário" />
            <div className="acoes">
              <button className="botao botao--principal pequeno" disabled={!!aniv && !aniversarioOk(aniv)} onClick={salvar}>Salvar</button>
              <button className="botao botao--fantasma pequeno" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </>
        ) : (
          <button className="item item--compacto" onClick={() => setEditando(true)}>
            <span>🎂 {cliente.aniversario ? `Aniversário: ${aniversarioTxt(cliente.aniversario)}` : `Cadastre seu aniversário${barbearia?.descontoAniversario ? ` e ganhe ${barbearia.descontoAniversario}%` : ''}`}</span>
            <span className="suave pequeno">{cliente.aniversario ? 'alterar' : 'cadastrar'}</span>
          </button>
        )}
        <button className="botao botao--fantasma pequeno" onClick={() => { api.sair(); definirCliente(null) }}>Sair</button>
      </section>
      <SeusDados />
    </>
  )
}

/** Privacidade: o que a barbearia guarda, para que serve, baixar e apagar */
function SeusDados() {
  const { barbearia, definirCliente, avisar, confirmar } = useApp()
  const [aberto, setAberto] = useState(false)
  const casa = barbearia?.nome ?? 'A barbearia'
  const baixar = async () => {
    try {
      const dados = await api.meusDados()
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = 'meus-dados-roque.json'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { avisar((e as Error).message, 'erro') }
  }
  const apagar = async () => {
    if (!(await confirmar('Apagar sua conta? Seus horários marcados são cancelados e seu nome, WhatsApp, aniversário, selos e mensagens são apagados. Não dá para desfazer.', { botao: 'Apagar conta' }))) return
    try { await api.excluirConta(); definirCliente(null); avisar('Conta apagada') } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <section className="cartao">
      <button className="item item--compacto" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <span>🔒 Seus dados e privacidade</span>
        <span className="suave pequeno">{aberto ? 'fechar' : 'ver'}</span>
      </button>
      {aberto && (
        <div className="privacidade">
          <p className="suave pequeno">{casa} guarda seu <strong>nome</strong>, <strong>WhatsApp</strong>, <strong>aniversário</strong> (se você cadastrou), seus <strong>horários</strong>, <strong>avaliações</strong> e <strong>pedidos</strong>.</p>
          <p className="suave pequeno">Serve só para agendar, lembrar do seu horário, dar os selos e o desconto de aniversário. Nada é vendido nem compartilhado, e o app não usa rastreamento, anúncios nem fontes ou scripts de terceiros. As mensagens do WhatsApp ficam guardadas por 6 meses.</p>
          <div className="acoes">
            <button className="botao botao--fantasma pequeno" onClick={baixar}>Baixar meus dados</button>
            <button className="botao botao--perigo pequeno" onClick={apagar}>Apagar minha conta</button>
          </div>
        </div>
      )}
    </section>
  )
}
